const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000;
const app = express();
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
var jwt = require('jsonwebtoken');

// all the middleware here
app.use(cors());
app.use(express.json());

const verifyUserToken = (req, res, next)=> {
    const authorization = req.headers.authorization;
    // console.log("token:" ,authorization);

    if(!authorization){
      return res.status(401).send({error: true, message: 'unauthorized access'});
    }
  
    const token = authorization.split(' ')[1];
    
    jwt.verify(token, process.env.JWT_SECRET_TOKEN, (err, decoded)=>{
      if(err){
        return res.status(403).send({error: true, message: 'unauthorized access'});
      }
      req.decoded = decoded;
      next()
    });
}


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

    app.post("/jwt", (req, res)=> {
        const payLoad = req.body;
        const token = jwt.sign({
            data: payLoad
          }, process.env.JWT_SECRET_TOKEN, { expiresIn: '1h' });
          res.send(token);
    });

    // all the collection 
    const database = client.db('culinaryCompass');
    const usersCollection = database.collection('users');
    const classesCollection = database.collection('classes');


    // user create api
    app.post("/users", async(req, res)=> {
        const insertAbleUser = req.body;

        const query = {email: insertAbleUser.email};
        const matchedData = await usersCollection.findOne(query);

        if(matchedData){
            return res.send("data already exists");
        }

        const insertedUser = await usersCollection.insertOne(insertAbleUser)
        res.send(insertedUser);

    });

    // user role change api
    app.patch("/users/:id", async(req, res)=> {
        const userId = req.params.id;
        const userRole = req.body;
        // console.log(userId, userRole);
        const query = {_id: new ObjectId(userId)};

        const updateAbleData = {
            $set:{
                role: userRole.role,
            },
        }
        const updatedUser = await usersCollection.updateOne(query, updateAbleData);
        res.send(updatedUser);

    });

    // user get api data
    app.get("/users",verifyUserToken, async(req,res)=> {
        const usersData = await usersCollection.find().toArray();
        res.send(usersData);
    });

    // classes insertion Api
    app.post("/classes", verifyUserToken, async(req, res)=> {
        const insertAbleData = req.body;
        const insertedData = await classesCollection.insertOne(insertAbleData);
        res.status(200).send(insertedData);
    });

    // get specific email based classes data api
    app.get("/classes",verifyUserToken, async(req,res)=> {
        const email = req.query.email;
        const tokenEmail = req.decoded.data.email;
        // console.log(req)
        if(tokenEmail !== email){
            return res.status(403).send({error: true, message: 'Forbidden User'})
        }
       
        const query = {instructorEmail: email};
        
        const classesData = await classesCollection.find(query).toArray();
        console.log(query)
        res.send(classesData)
    });

    // get all classes Data api
    app.get("/allClasses", verifyUserToken, async(req,res)=> {
        
        const allClassesData = await classesCollection.find().toArray();
        res.send(allClassesData);
    })



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