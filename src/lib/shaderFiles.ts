const SHADER_FILE_EXTENSION = '.frag'
const SHADER_FILE_TYPE = {
  description: 'GLSL fragment shaders',
  accept: {
    'text/plain': [SHADER_FILE_EXTENSION],
  },
}
const DIRECTORY_DB_NAME = 'shader-file-system'
const DIRECTORY_STORE_NAME = 'handles'
const DIRECTORY_HANDLE_KEY = 'shader-directory'

let shaderDirectoryHandle: FileSystemDirectoryHandle | null = null
let shaderDirectoryPromise: Promise<FileSystemDirectoryHandle | null> | null = null

type PickerWindow = Window & {
  showDirectoryPicker?: (options?: { id?: string; mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>
  showOpenFilePicker?: (options?: {
    id?: string
    multiple?: boolean
    startIn?: FileSystemDirectoryHandle
    types?: Array<{
      description?: string
      accept: Record<string, string[]>
    }>
    excludeAcceptAllOption?: boolean
  }) => Promise<FileSystemFileHandle[]>
  showSaveFilePicker?: (options?: {
    id?: string
    startIn?: FileSystemDirectoryHandle
    suggestedName?: string
    types?: Array<{
      description?: string
      accept: Record<string, string[]>
    }>
    excludeAcceptAllOption?: boolean
  }) => Promise<FileSystemFileHandle>
}

type SupportedPickerWindow = Window & {
  showDirectoryPicker: NonNullable<PickerWindow['showDirectoryPicker']>
  showOpenFilePicker: NonNullable<PickerWindow['showOpenFilePicker']>
  showSaveFilePicker: NonNullable<PickerWindow['showSaveFilePicker']>
}

function supportsFileSystemAccess() {
  if (typeof window === 'undefined') {
    return false
  }

  const pickerWindow = window as PickerWindow

  return (
    typeof pickerWindow.showDirectoryPicker === 'function' &&
    typeof pickerWindow.showOpenFilePicker === 'function' &&
    typeof pickerWindow.showSaveFilePicker === 'function'
  )
}

async function pickShaderDirectory() {
  const picker = (window as PickerWindow).showDirectoryPicker

  if (!picker) {
    throw new Error('This browser does not support the File System Access API.')
  }

  return picker({
    id: 'shader-directory',
    mode: 'readwrite',
  })
}

function openDirectoryDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DIRECTORY_DB_NAME, 1)

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(DIRECTORY_STORE_NAME)) {
        database.createObjectStore(DIRECTORY_STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB.'))
  })
}

function runRequest<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'))
  })
}

async function readStoredDirectoryHandle() {
  const database = await openDirectoryDatabase()

  try {
    const transaction = database.transaction(DIRECTORY_STORE_NAME, 'readonly')
    const store = transaction.objectStore(DIRECTORY_STORE_NAME)
    const handle = await runRequest(store.get(DIRECTORY_HANDLE_KEY) as IDBRequest<FileSystemDirectoryHandle | undefined>)
    return handle ?? null
  } finally {
    database.close()
  }
}

async function storeDirectoryHandle(handle: FileSystemDirectoryHandle) {
  const database = await openDirectoryDatabase()

  try {
    const transaction = database.transaction(DIRECTORY_STORE_NAME, 'readwrite')
    const store = transaction.objectStore(DIRECTORY_STORE_NAME)
    await runRequest(store.put(handle, DIRECTORY_HANDLE_KEY))
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not store directory handle.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Could not store directory handle.'))
    })
  } finally {
    database.close()
  }
}

async function clearStoredDirectoryHandle() {
  const database = await openDirectoryDatabase()

  try {
    const transaction = database.transaction(DIRECTORY_STORE_NAME, 'readwrite')
    const store = transaction.objectStore(DIRECTORY_STORE_NAME)
    await runRequest(store.delete(DIRECTORY_HANDLE_KEY))
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not clear directory handle.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Could not clear directory handle.'))
    })
  } finally {
    database.close()
  }
}

async function loadStoredDirectoryHandle() {
  if (shaderDirectoryHandle) {
    return shaderDirectoryHandle
  }

  if (!shaderDirectoryPromise) {
    shaderDirectoryPromise = readStoredDirectoryHandle()
      .then((handle) => {
        shaderDirectoryHandle = handle
        return handle
      })
      .finally(() => {
        shaderDirectoryPromise = null
      })
  }

  return shaderDirectoryPromise
}

async function getShaderDirectory() {
  if (shaderDirectoryHandle) {
    return shaderDirectoryHandle
  }

  const storedHandle = await loadStoredDirectoryHandle()

  if (storedHandle) {
    shaderDirectoryHandle = storedHandle
    return storedHandle
  }

  shaderDirectoryHandle = await pickShaderDirectory()
  await storeDirectoryHandle(shaderDirectoryHandle)
  return shaderDirectoryHandle
}

function getPickerWindow() {
  const pickerWindow = window as PickerWindow

  if (
    !pickerWindow.showDirectoryPicker ||
    !pickerWindow.showOpenFilePicker ||
    !pickerWindow.showSaveFilePicker
  ) {
    throw new Error('This browser does not support the File System Access API.')
  }

  return pickerWindow as SupportedPickerWindow
}

function withShaderExtension(name: string) {
  return name.endsWith(SHADER_FILE_EXTENSION) ? name : `${name}${SHADER_FILE_EXTENSION}`
}

export async function saveShader(source: string) {
  const pickerWindow = getPickerWindow()
  let directory = await getShaderDirectory()
  let fileHandle: FileSystemFileHandle

  try {
    fileHandle = await pickerWindow.showSaveFilePicker({
      id: 'shader-save-file',
      startIn: directory,
      suggestedName: 'shader.frag',
      types: [SHADER_FILE_TYPE],
      excludeAcceptAllOption: true,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') {
      await clearStoredDirectoryHandle()
      shaderDirectoryHandle = await pickShaderDirectory()
      await storeDirectoryHandle(shaderDirectoryHandle)
      directory = shaderDirectoryHandle
      fileHandle = await pickerWindow.showSaveFilePicker({
        id: 'shader-save-file',
        startIn: directory,
        suggestedName: 'shader.frag',
        types: [SHADER_FILE_TYPE],
        excludeAcceptAllOption: true,
      })
    } else {
      throw error
    }
  }

  const writable = await fileHandle.createWritable()
  await writable.write(source)
  await writable.close()

  return {
    directoryName: directory.name,
    fileName: withShaderExtension(fileHandle.name),
  }
}

export async function loadShader() {
  const pickerWindow = getPickerWindow()
  let directory = await getShaderDirectory()
  let fileHandle: FileSystemFileHandle

  try {
    ;[fileHandle] = await pickerWindow.showOpenFilePicker({
      id: 'shader-open-file',
      multiple: false,
      startIn: directory,
      types: [SHADER_FILE_TYPE],
      excludeAcceptAllOption: true,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') {
      await clearStoredDirectoryHandle()
      shaderDirectoryHandle = await pickShaderDirectory()
      await storeDirectoryHandle(shaderDirectoryHandle)
      directory = shaderDirectoryHandle
      ;[fileHandle] = await pickerWindow.showOpenFilePicker({
        id: 'shader-open-file',
        multiple: false,
        startIn: directory,
        types: [SHADER_FILE_TYPE],
        excludeAcceptAllOption: true,
      })
    } else {
      throw error
    }
  }

  const file = await fileHandle.getFile()

  return {
    directoryName: directory.name,
    fileName: file.name,
    source: await file.text(),
  }
}

export function getShaderDirectoryName() {
  return shaderDirectoryHandle?.name ?? ''
}

export async function restoreShaderDirectory() {
  return loadStoredDirectoryHandle()
}

export { SHADER_FILE_EXTENSION, supportsFileSystemAccess }
