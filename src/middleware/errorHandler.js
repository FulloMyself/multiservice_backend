export function errorHandler(error, req, res, next) {
  console.error('Unhandled error:', error);

  res.status(500).json({
    success: false,
    message: 'Something went wrong while processing your request.',
    errorCode: 'SERVER_ERROR'
  });
}
