const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000;
const app = express();
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

app.use(cors());
app.use(express.json());

app.get("/", (req,res)=> {
    res.send('server connected')
});



const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASS}@cluster0.uhsxkqi.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection


    // all the collection 
    const database = client.db('culinaryCompass');
    const usersCollection = database.collection('users');
    // user create api
    app.post("/users", async(req, res)=> {
        const insertAbleUser = req.body;
        console.log(insertAbleUser);

        const query = {email: insertAbleUser.email};
        const matchedData = await usersCollection.findOne(query);

        if(matchedData){
            return res.send("data already exists");
        }

        const insertedUser = await usersCollection.insertOne(insertAbleUser)
        res.send(insertedUser);

    });



    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port, ()=> {
    console.log('server connected successfully')
});