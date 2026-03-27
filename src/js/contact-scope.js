export function toScopedContactPayload(contact, userId) {
  return {
    id: contact.id,
    user_id: userId,
    name: contact.name || '',
    title: contact.title || '',
    company: contact.company || '',
    email: contact.email || '',
    phone: contact.phone || '',
    website: contact.website || '',
    occasion: contact.occasion || '',
    date: contact.date || null,
    notes: contact.notes || '',
    image_data: contact.imageData || '',
    front_image_path: contact.frontImagePath || null,
    back_image_path: contact.backImagePath || null,
    created_at: contact.createdAt || new Date().toISOString(),
    updated_at: contact.updatedAt || new Date().toISOString()
  };
}
