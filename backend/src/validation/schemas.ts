export function validateCreateFolder(body: any) {
  if (!body || typeof body !== 'object') throw { status: 400, code: 'INVALID_BODY', message: 'Body required' };
  const { parent_id, name, type } = body;
  if (typeof parent_id !== 'number') throw { status: 400, code: 'INVALID_PARENT', message: 'parent_id must be number' };
  if (!name || typeof name !== 'string') throw { status: 400, code: 'INVALID_NAME', message: 'name required' };
  const allowed = ['company','country','cedant','category','treaty_section','generic'];
  if (!allowed.includes(type)) throw { status: 400, code: 'INVALID_TYPE', message: 'invalid folder type' };
  return { parent_id, name, type };
}

export function validateMoveFolder(body: any) {
  const { newParentId } = body || {};
  if (typeof newParentId !== 'number') throw { status: 400, code: 'INVALID_NEW_PARENT', message: 'newParentId must be number' };
  return { newParentId };
}

export function validateUploadFiles(_req: any) {
  // Placeholder: rely on multipart parser in real implementation
  return true;
}