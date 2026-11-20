export async function demoRequest(path, body) {
  let response;
  let data;
  try {
    response = await fetch(`/api${path}`, body === undefined ? undefined : {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    data = await response.json();
  } catch {
    throw new Error('Torque’s demo server is unreachable. Check that npm run dev is running.');
  }
  if (!response.ok) {
    const error = new Error(data.error || 'Torque could not complete this request.');
    error.statusCode = response.status;
    throw error;
  }
  return data;
}
