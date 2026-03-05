import ResponseFormatter from '../utils/ResponseFormatter.js';

const notFound = (req, res) => {
  return ResponseFormatter.notFound(res, 'Route');
};

export default notFound;
