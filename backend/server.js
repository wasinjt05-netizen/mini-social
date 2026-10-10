import 'dotenv/config';
import app from './api/index.js';
const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`API: http://localhost:${port}/api/health`));
