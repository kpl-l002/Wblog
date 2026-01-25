exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Hello from Netlify Function!',
      path: event.path,
      httpMethod: event.httpMethod
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  };
};