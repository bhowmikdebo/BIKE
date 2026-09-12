import { useState } from 'react'
import type { FormEvent } from 'react'
import { Dialog, ImageAsset } from '../../components/ui'
import { categories, cities } from '../../../../shared/fleet.ts'
import type { BikeInput, ManagedBike } from '../../../../shared/types.ts'
import { api, errorMessage } from '../../utils/api'

const uploadLimit = 2 * 1024 * 1024
const uploadTypes = ['image/jpeg', 'image/png', 'image/webp']

function readImage(file: File) {
  if (file.size > uploadLimit) throw new Error('Upload an image under 2 MB.')
  if (!uploadTypes.includes(file.type)) throw new Error('Choose a JPG, PNG or WebP image.')
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read that image.'))
    reader.readAsDataURL(file)
  })
}

export function BikeEditor({ bike, onClose, onSaved }: { bike?: ManagedBike; onClose: () => void; onSaved: (bike: ManagedBike) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    const text = (field: string) => String(form.get(field) || '')
    const file = form.get('photo')
    try {
      const payload: BikeInput = {
        brand: text('brand'), model: text('model'), description: text('description'),
        category: text('category') as BikeInput['category'], transmission: text('transmission') as BikeInput['transmission'],
        price: Number(text('price')), engine: Number(text('engine')), mileage: Number(text('mileage')), seats: Number(text('seats')),
        cities: text('cities').split(',').map(city => city.trim()).filter(Boolean),
        features: text('features').split('\n').map(feature => feature.trim()).filter(Boolean),
        fuel: 'Petrol', imageUrl: text('imageUrl'),
        active: form.has('active'),
        image: file instanceof File && file.size ? await readImage(file) : form.has('removeImage') ? null : undefined,
      }
      const updated = await api<ManagedBike>(bike ? `/api/admin/bikes/${bike.id}` : '/api/admin/bikes', { method: bike ? 'PUT' : 'POST', body: payload })
      onSaved(updated)
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return <Dialog title={bike ? 'Edit bike' : 'Add a bike'} className="fleet-editor" onClose={() => { if (!busy) onClose() }}>
    <form onSubmit={save} className="contact-form">
      <div className="form-pair">
        <label className="field"><span>Brand</span><input name="brand" required maxLength={80} defaultValue={bike?.brand} /></label>
        <label className="field"><span>Model</span><input name="model" required maxLength={80} defaultValue={bike?.model} /></label>
      </div>
      <div className="form-pair">
        <label className="field"><span>Category</span><select name="category" defaultValue={bike?.category ?? ''} required><option value="">Select a category</option>{categories.map(item => <option key={item.name}>{item.name}</option>)}</select></label>
        <label className="field"><span>Transmission</span><select name="transmission" defaultValue={bike?.transmission ?? 'Manual'} required><option>Manual</option><option>Automatic</option></select></label>
      </div>
      <div className="admin-specs">
        <label className="field"><span>Daily rate (₹)</span><input name="price" type="number" min={1} max={1_000_000} required defaultValue={bike?.price} /></label>
        <label className="field"><span>Engine (cc)</span><input name="engine" type="number" min={1} max={5000} required defaultValue={bike?.engine} /></label>
        <label className="field"><span>Mileage (km/l)</span><input name="mileage" type="number" min={1} max={500} required defaultValue={bike?.mileage} /></label>
        <label className="field"><span>Seats</span><select name="seats" defaultValue={bike?.seats ?? 2}><option>1</option><option>2</option></select></label>
      </div>
      <label className="field"><span>Pickup cities</span><input name="cities" required maxLength={600} defaultValue={bike?.cities.join(', ')} placeholder={cities.slice(0, 2).join(', ')} /><small>Separate cities with commas. Each listing represents one bike.</small></label>
      <label className="field"><span>Description</span><textarea name="description" required rows={3} maxLength={1800} defaultValue={bike?.description} /></label>
      <label className="field"><span>Features</span><textarea name="features" required rows={3} maxLength={1800} defaultValue={bike?.features.join('\n')} /><small>Put one feature on each line.</small></label>
      <div className="form-pair">
        <label className="field"><span>Upload bike photo</span><input name="photo" type="file" accept={uploadTypes.join(',')} /><small>JPG, PNG or WebP up to 2 MB.</small></label>
        <label className="field"><span>Image URL</span><input name="imageUrl" maxLength={400} placeholder="https://…" defaultValue={bike?.imageUrl} /><small>Optional. An uploaded photo takes priority.</small></label>
      </div>
      {bike?.hasUploadedImage && <div className="editor-image"><ImageAsset src={`/api/bikes/${bike.id}/image`} width={90} height={60} alt="Current uploaded bike photo" /><label className="agreement"><input type="checkbox" name="removeImage" /> <span>Remove uploaded photo</span></label></div>}
      <label className="agreement"><input type="checkbox" name="active" defaultChecked={bike?.active ?? true} /> <span>Publish this bike to the rental catalog</span></label>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="portal-actions"><button className="button button-outline" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="button primary" disabled={busy} type="submit">{busy ? 'Saving…' : 'Save bike'}</button></div>
    </form>
  </Dialog>
}
