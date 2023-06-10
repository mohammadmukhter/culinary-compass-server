const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000;

const app = express();
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.PAYMENT_SECRET);
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


    // JWT token Creator api
    app.post("/jwt", (req, res)=> {
        const payLoad = req.body;
        const token = jwt.sign({
            data: payLoad
          }, process.env.JWT_SECRET_TOKEN, { expiresIn: '1hr' });
          res.send(token);
    });

    // all the collection 
    const database = client.db('culinaryCompass');
    const usersCollection = database.collection('users');
    const classesCollection = database.collection('classes');
    const selectedClassesCollection = database.collection('selectedClasses');
    const paymentsCollection = database.collection('payments');


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
    app.patch("/users/:id",verifyUserToken,  async(req, res)=> {
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

    // all approved Class get api || PUBLIC API
    app.get("/approvedClasses", async(req, res)=> {
        const query = {status: 'approved'};

        const approvedClasses = await classesCollection.find(query).toArray();
        res.send(approvedClasses);
    });

    // classes insertion Api
    app.post("/classes", verifyUserToken, async(req, res)=> {
        const insertAbleData = req.body;
        const insertedData = await classesCollection.insertOne(insertAbleData);
        res.status(200).send(insertedData);
    });

    // classes status change api
    app.patch("/classes/:id",verifyUserToken, async(req, res)=> {
        const classId = req.params.id;
        const classStatus = req.body.status;

        const query = {_id: new ObjectId(classId)};
        const updateAbleStatus = {
            $set: {
                status:classStatus,
            },
        }
        const updatedClass = await classesCollection.updateOne(query, updateAbleStatus);
        res.send(updatedClass);
    });

    // classes feedback change api
    app.patch("/classesFeedback/:id",verifyUserToken, async(req, res)=> {
        const classId = req.params.id;
        const classFeedback = req.body.feedback;

        const query = {_id: new ObjectId(classId)};
        const updateAbleFeedback = {
            $set: {
                feedback:classFeedback,
            },
        }
        const updatedClass = await classesCollection.updateOne(query, updateAbleFeedback);
        res.send(updatedClass);
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
        // console.log(query)
        res.send(classesData)
    });

    // get all classes Data api
    app.get("/allClasses", verifyUserToken, async(req,res)=> {
        
        const allClassesData = await classesCollection.find().toArray();
        res.send(allClassesData);
    });


    // selected Classes or cart classes add or insert api 
    app.post("/selectedClasses",verifyUserToken, async(req, res)=> {
        const payLoadData = req.body;
        const classId = payLoadData.classId;
        const studentEmail = payLoadData.studentEmail;

        const query = {
            classId: classId,
            studentEmail: studentEmail
        }

        const matchedData = await selectedClassesCollection.findOne(query);

        if(matchedData){
            return res.send({error: true, message: 'Data Already exists'});
        }

        const insertedData = await selectedClassesCollection.insertOne(payLoadData);
        res.send(insertedData);
    });

    // get all the selected classes Api 
    app.get("/selectedClasses",verifyUserToken,  async(req, res)=> {
        const email = req.query.email;
        const tokenEmail = req.decoded.data.email;

        if(email !== tokenEmail){
            return res.status(403).send({error: true, message: "Forbidden Access"})
        };

        const query = {
            studentEmail: email,
        };

        const selectedData = await selectedClassesCollection.find(query).toArray();
        res.status(200).send(selectedData);
        
    });

    // stripe payment intent create api
    app.post("/createPaymentIntent",verifyUserToken, async (req, res)=> {
        const {price} = req.body;
        const amount = price*100;

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: "usd",
            payment_method_types: ['card']
        });

        res.send({
            clientSecret: paymentIntent.client_secret,
        });
    });

    // payment data store to database api
    app.post("/payments",verifyUserToken, async(req, res)=>{
        const insertAbleData = req.body;
        const selectedClassId = req.body.selectedClassId;
        const classId = req.body.classId;

        const selectQuery = {
            _id: new ObjectId(selectedClassId),
        }

        // data deleted by selectedClassId from selectedClassesCollection
        const deletedDataFromSelectClasses =  await selectedClassesCollection.deleteOne(selectQuery);

        const classQuery = {
            _id: new ObjectId(classId),
        }

        // decrement availAbleSeat filed value by 1
        const availableSeatData = {
            $inc:{
                availAbleSeat: -1,
            },
        }

        // data updated by classId from classesCollection
        const updatedClassData = await classesCollection.updateOne(classQuery, availableSeatData);

        // payment data inserted to paymentsCollection
        const insertedData = await paymentsCollection.insertOne(insertAbleData);

        res.send({insertedData, deletedDataFromSelectClasses, updatedClassData});
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