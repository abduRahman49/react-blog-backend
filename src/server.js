import express from 'express';
import fs from 'fs';
import admin from 'firebase-admin';
import { db, connectToDb } from './db.js';


const credentials = JSON.parse(process.env.FIREBASE_CREDENTIALS)

// Telling firebase-admin package what credentials to use to connect to our project
admin.initializeApp({
    credential: admin.credential.cert(credentials)
})


const app = express();
app.use(express.json())

app.use(async (req, res, next) => {
    const { authtoken } = req.headers;
    if (authtoken) {
        console.log('Token', authtoken);
        try {
            req.user = await admin.auth().verifyIdToken(authtoken);
        } catch {
            console.log("Entered here..., i mean first middleware");
            return res.sendStatus(400);
        }
    }
    req.user = req.user || {};
    next();
})

app.get('/api/articles/:name', async (req, res) => {
    const { name } = req.params;
    const { uid } = req.user;

    const article = await db.collection('articles').findOne({ name });
    if(article) {
        const upvoteIds = article.upvoteIds || [];
        article.canUpvote = uid && !upvoteIds.includes(uid);
        res.json(article);
    } else {
        res.sendStatus(404);
    }

})

// For the routes below this middleware checks if user is authenticated (req.user set) and continues execution else sends http error code
app.use((req, res, next) => {
    if(req.user) {
        next()
    } else {
        console.log("Entered here..., i mean second middleware");
        res.sendStatus(400);
    }
})

app.put('/api/articles/:name/upvote', async (req, res) => {
    const { name } = req.params;
    const { uid } = req.user;
    
    const article = await db.collection('articles').findOne({ name });

    if(article) {
        const upvoteIds = article.upvoteIds || [];
        const canUpvote = uid && !upvoteIds.includes(uid);

        if(canUpvote) {
            await db.collection('articles').updateOne({ name }, {
                $inc: { upvotes: 1 },
                $push: { upvoteIds : uid }
            })
        }
        const updatedArticle = await db.collection('articles').findOne({ name });
        res.json(updatedArticle);
    } else {
        res.send("The article does't exist");
    }
})

app.post('/api/articles/:name/comments', async (req, res) => {
    const { name } = req.params;
    const { text } = req.body;
    const { email } = req.user;
    
    await db.collection('articles').updateOne({ name }, { $push: { comments : { postedBy: email, text }} })
    const article = await db.collection('articles').findOne({ name });
    
    if(article) {
        res.json(article)
    } else {
        res.send("The article does't exist")
    }
});

connectToDb(() => {
    console.log("Connected successfully to database.")
    app.listen(8000, () => {
        console.log("Server is listening on port 8000 ...");
    })
})