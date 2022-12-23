require('dotenv').config();

const express = require ('express/');
const PORT = 3000;
const server = express();
const apiRouter = require('./api');
const morgan = require('morgan');
const { client } = require('./db');


// express MIDDLEWARE

server.use(morgan('dev'));

server.use(express.json());

server.use((req, res, next) => {
  console.log("<____Body Logger START____>");
  console.log(req.body);
  console.log("<_____Body Logger END_____>");
  
  next();
});

server.use('/api', apiRouter);

server.get('/background/:color', (req, res, next) => {
  res.send(`
    <body style = "background: ${ req.params.color };">
      <h1> Hello World </h1>
    </body>
  `);
});

server.get('/add/:first/to/:second', (req, res, next) => {
  res.send(`<h1>${ req.params.first } + ${ req.params.second } = ${
    Number(req.params.first) + Number(req.params.second)
  }</h1>`);
});


client.connect();

server.listen(PORT, () => {
  console.log('The server is up on the port', PORT)
});
