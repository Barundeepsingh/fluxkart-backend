import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import { getConsolidatedContact } from './contact.model';

const app = express();
const port = process.env.POST || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.get('/', (req: Request, res: Response) => {
  res.send('Hello, World!');
});

app.post('/identify', async (req: Request, res: Response) => {
  const { email, phoneNumber } = req.body;

  try {
      // Validate input types if necessary
      if (email && typeof email !== 'string') {
          return res.status(400).json({ error: 'Invalid email format' });
      }
      if (phoneNumber && typeof phoneNumber !== 'string') {
          return res.status(400).json({ error: 'Invalid phone number format' });
      }

      // Process the request to get the consolidated contact
      const result = await getConsolidatedContact(email || null, phoneNumber || null);

      // Respond with the consolidated contact
      res.status(200).json({ contact: result });
  } catch (error) {
      console.error('Error identifying contact:', error);

  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
