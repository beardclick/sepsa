function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('sepsa-contract-files', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('files')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
export async function savePdf(file) {
  if (file.size > 20 * 1024 * 1024)
    throw new Error('El PDF debe pesar menos de 20 MB.')
  if (!(await file.slice(0, 5).text()).startsWith('%PDF-'))
    throw new Error('Selecciona un archivo PDF válido.')
  const id = crypto.randomUUID(),
    db = await database()
  await new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite')
    tx.objectStore('files').put(
      new Blob([file], { type: 'application/pdf' }),
      id,
    )
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
  db.close()
  return { id, nombre: file.name, size: file.size }
}
export async function downloadPdf(file) {
  const db = await database()
  const blob = await new Promise((resolve, reject) => {
    const r = db.transaction('files').objectStore('files').get(file.id)
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
  db.close()
  if (!blob)
    throw new Error(
      'Este PDF no está disponible en este navegador. Vuelve a adjuntarlo.',
    )
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: file.nombre,
  })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportAttachments(contracts) {
  const refs = contracts.flatMap((c) => c.documentos || [])
  if (!refs.length) return []
  const db = await database()
  try {
    const attachments = []
    for (const ref of refs) {
      const blob = await new Promise((resolve, reject) => {
        const req = db.transaction('files').objectStore('files').get(ref.id)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
      if (!blob)
        throw new Error(
          `No se encontró el adjunto ${ref.nombre}. Vuelve a adjuntarlo antes de exportar.`,
        )
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      attachments.push({ ...ref, dataUrl })
    }
    return attachments
  } finally {
    db.close()
  }
}

export async function importAttachments(attachments = []) {
  if (!attachments.length) return
  const entries = attachments.map((file) => {
    if (
      !file.id ||
      typeof file.dataUrl !== 'string' ||
      !file.dataUrl.startsWith('data:application/pdf;base64,')
    )
      throw new Error('Adjunto PDF inválido en el respaldo.')
    const binary = atob(file.dataUrl.split(',')[1])
    if (!binary.startsWith('%PDF-') || binary.length > 20 * 1024 * 1024)
      throw new Error('Adjunto PDF inválido en el respaldo.')
    return [
      file.id,
      new Blob([Uint8Array.from(binary, (c) => c.charCodeAt(0))], {
        type: 'application/pdf',
      }),
    ]
  })
  const db = await database()
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite')
      for (const [id, blob] of entries) tx.objectStore('files').put(blob, id)
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}
