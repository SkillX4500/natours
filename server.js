const dotenv = require('dotenv');
const mongoose = require('mongoose');

process.on('uncaughtException', err => {
  console.log('UncaughtException 🔴 Shutting down server...💀');
  console.log(`${err}`);

  process.exit(1);
});

dotenv.config({ path: './config.env' });
mongoose.set('strictQuery', false);

const app = require('./app');

const port = process.env.PORT;
const DB = process.env.DATABASE.replace(
  '<password>',
  process.env.DATABASE_PASSWORD
);

async function dbConnect() {
  await mongoose.connect(DB);
}

dbConnect().then(() => console.log('Database linked 😎😎😎 !!!'));

const server = app.listen(port, 'localhost', () => {
  console.log(`App running on port ${port}...✅✅✅`);
});

process.on('unhandledRejection', err => {
  console.log('UnhandledRejection 🔴 Shutting down server...💀');
  console.log(err.name, err.message);

  server.close(() => process.exit(1));
});
