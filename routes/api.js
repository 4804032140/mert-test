const express = require('express');
const router = express.Router();
const cors = require('cors');
const Todo = require('../models/todo');
const MongoClient = require("mongodb").MongoClient;
const ObjectId = require("mongodb").ObjectId;
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');

require('dotenv').config()

function authenticateToken(req, res, next) {
  const token = req.header('Authorization');
  if (!token) {
    return res.status(401).json({
      msg: 'Access denied, token not provided'
    });
  }

  jwt.verify(token, 'key', (err, user) => {
    if (err) {
      return res.status(403).json({
        msg: 'Invalid token'
      });
    }

    req.user = user;
    next();
  });
}


router.get('/get', (req, res, next) => {
  // This will return all the data, exposing only the id and action field to the client
  Todo.find({}, 'action')
    .then((data) => res.json(data))
    .catch(next);
});

router.post('/make', (req, res, next) => {
  if (req.body.action) {
    Todo.create(req.body)
      .then((data) => res.json(data))
      .catch(next);
  } else {
    res.json({
      error: 'The input field is empty',
    });
  }
});

router.delete('/delete/:id', (req, res, next) => {
  Todo.findOneAndDelete({ _id: req.params.id })
    .then((data) => res.json(data))
    .catch(next);
});

router.post('/login', async (req, res, next) => {
  try {
    const client = await MongoClient.connect(process.env.DB);
    const database = client.db('COP4331');
    const collection = database.collection('Users');
    
    // Perform user authentication
    const users = await collection.find({ Username: req.body.username, Password: req.body.password }).toArray();

    if (users.length > 0) {
      // User authenticated successfully

      // Generate JWT token
      const token = jwt.sign({ username: req.body.username }, 'key', { expiresIn: '1h' });
      console.log(users[0].Username);
      
      res.json({
        msg: users,
        token: token
      });
    } else {
      // User authentication failed
      res.status(401).json({
        msg: 'Authentication failed'
      });
    }

    await client.close();
  } catch (error) {
    console.error(error);
    res.status(500).json({
      msg: 'Internal server error'
    });
  }
});

router.post('/register', async (req, res, next) => {
  const client = await MongoClient.connect(process.env.DB);
  const database = client.db('COP4331');
  const collection = database.collection('Users');
  const unverifiedCollection = database.collection('Unverified Users');
  try {

    const existingUserByUsername = await collection.findOne({ Username: req.body.username });
    const existingUserByEmail = await collection.findOne({ Email: req.body.email });
    const existingUserByUsernameUnverified = await unverifiedCollection.findOne({ Username: req.body.username });
    const existingUserByEmailUnverified = await unverifiedCollection.findOne({ Email: req.body.email });

    if (existingUserByUsername) {
      res.status(500).json({
        err: "Username is already taken. Please choose a different username."
      });
      return;
    }
    if (existingUserByEmail) {
      res.status(500).json({
        err: "Email is already registered. Please use a different email address."
      });
      return;
    }
    if (existingUserByUsernameUnverified) {
      res.status(500).json({
        err: "Username is already taken. Please choose a different username."
      });
      return;
    }
    if (existingUserByEmailUnverified) {
      res.status(500).json({
        err: "Email is already registered. Please use a different email address."
      });
      return;
    }

    // Generate a verification code
    const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const transporter = nodemailer.createTransport({
        host: 'smtp.zoho.com',
        port: 465,
        secure: true,
      auth: {
          user: 'nodemailer123321@zohomail.com',
          pass: process.env.EMAILPWD,
        },
    });

    // Send verification code via email
    const mailOptions = {
      from: 'nodemailer123321@zohomail.com',
      to: req.body.email,
      subject: 'Veggie Tasks Verification Code',
      text: verificationCode,
    };
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
        return;
      } else {
        console.log('Email sent:', info.response);
      }
    });

    // Store user information in the "Unverified Users" database
    const date = new Date();
    const id = new ObjectId();
    await unverifiedCollection.insertOne({
      _id: id,
      FirstName: req.body.firstname,
      LastName: req.body.lastname,
      Username: req.body.username,
      Password: req.body.password,
      DateCreated: date,
      DateLastLoggedIn: "",
      Email: req.body.email,
      Recipes: [],
      Tasks: [],
      VerifyCode: verificationCode,
      PasswordChangeable: false
    });

    res.json({
      success: true,
      message: "Check your email for verification."
    });

  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.close(); 
  }
});

router.post('/verify', async (req, res, next) => {
  const client = await MongoClient.connect(process.env.DB);
  const database = client.db('COP4331');
  const collection = database.collection('Users');
  const unverifiedCollection = database.collection('Unverified Users');
  const basketsCollection = database.collection('Baskets');

  try {
    console.log("Inside /verify endpoint");
    
    const verificationCodeMatches = await unverifiedCollection.findOne({ VerifyCode: req.body.verificationCode });


      const FirstNameQuery = verificationCodeMatches.FirstName;
      const LastNameQuery = verificationCodeMatches.LastName;
      const UsernameQuery = verificationCodeMatches.Username;
      const PasswordQuery = verificationCodeMatches.Password;
      const EmailQuery = verificationCodeMatches.Email;
      const date = new Date();
      const id = new ObjectId();

      // Insert the user into the 'Users' collection
      await collection.insertOne({
        _id: id,
        FirstName: FirstNameQuery,
        LastName: LastNameQuery,
        Username: UsernameQuery,
        Password: PasswordQuery,
        DateCreated: date,
        DateLastLoggedIn: "",
        Email: EmailQuery,
        Recipes: [],
        Tasks: [],
      });

      // Remove the entire document from the 'Unverified Users' collection
      await unverifiedCollection.deleteOne({ VerifyCode: req.body.verificationCode });
      const baskId = new ObjectId();
      // Insert a new basket document in the 'Baskets' collection
      await basketsCollection.insertOne({
        _id: baskId,
        User: UsernameQuery, // Assuming the 'User' field is related to the username
        Ingredients: []
      });

      res.json({
        success: true,
        message: "User is successfully verified and registered."
      });
    } catch (error) {
    console.error("Error during verification:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.close();
  }
});

router.put('/updateLastLoggedIn', async (req, res, next) => {
  const client = await MongoClient.connect(process.env.DB);
  const database = client.db('COP4331');
  const collection = database.collection('Users');
  const { username } = req.body;
  const currentDate = new Date();
  try {
    await collection.updateOne(
      { Username: username },
      { $set: { DateLastLoggedIn: currentDate } }
    );
    res.json({ msg: "DateLastLoggedIn updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ err: "Error updating DateLastLoggedIn" });
  }
  await client.close();
});


//endpoint for creating a task
router.post('/createTask', async (req, res, next) => {
  const client = await MongoClient.connect(process.env.DB);
  const database = client.db('COP4331');
  const usersCollection = database.collection('Users');
  const tasksCollection = database.collection('Tasks');

  try {
    const id = new ObjectId();
    await tasksCollection.insertOne({
      _id: id,
      User: req.body.username,
      Desc: req.body.desc,
      Ingredient: req.body.ingredient,
      DueDate: new Date(req.body.dueDate),
      EffortPoints: parseInt(req.body.effortPoints)
    });

    // Take in the user ID from the request (assuming you have it in req.body.userId)
    const username = req.body.username;

    // Find the user document by their unique identifier (e.g., username)
    const user = await usersCollection.findOne({ Username: username });

    if (!user) {
      res.status(404).json({ msg: "User not found" });
      return;
    }

    if (!user.Tasks) {
      // If 'Tasks' array doesn't exist, create it and initialize it with an array containing the new task ID
      user.Tasks = [id];
    } else {
      // If 'Tasks' array already exists, append the new task ID
      user.Tasks.push(id);
    }

    // Update the user document with the new 'Tasks' array
    await usersCollection.updateOne({ Username: username }, { $set: { Tasks: user.Tasks } });

    res.json({
      msg: "Task created and added to the user's Tasks"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Internal server error" });
  } finally {
    await client.close();
  }
});

router.delete('/deleteTask/:username/:taskId', async (req, res, next) => {
  const username = req.params.username; // Extract the user ID from the request parameters
  const taskId = req.params.taskId; // Extract the task ID from the request parameters

  const client = await MongoClient.connect(process.env.DB);
  const database = client.db('COP4331');
  const usersCollection = database.collection('Users');
  const tasksCollection = database.collection('Tasks');

  try {
    // Find the user document by their unique identifier (e.g., userId)
    const user = await usersCollection.findOne({ Username: username });

    if (!user) {
      res.status(404).json({ msg: "User not found" });
      return;
    }

    if (!user.Tasks || user.Tasks.length === 0) {
      res.status(404).json({ msg: "User has no tasks" });
      return;
    }

    // Convert taskId to ObjectId for comparison
    const taskObjectId = new ObjectId(taskId);
    
    // Check if the task ID is in the user's 'Tasks' array
    const taskIndex = user.Tasks.findIndex(task => task.equals(taskObjectId));

    if (taskIndex === -1) {
      res.status(404).json({ msg: "Task not found in the user's Tasks" });
      return;
    }

    // Remove the task ID from the user's 'Tasks' array
    user.Tasks.splice(taskIndex, 1);

    // Update the user document with the modified 'Tasks' array
    await usersCollection.updateOne({ Username: username }, { $set: { Tasks: user.Tasks } });

    // Find and delete the task document from the 'Tasks' collection
    await tasksCollection.findOneAndDelete({ _id: taskObjectId });

    res.json({ msg: "Task deleted from the user's Tasks and removed from the Tasks collection" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Internal server error" });
  } finally {
    await client.close();
  }
});

router.delete('/finishTask/:username/:taskId', async (req, res, next) => {
  const username = req.params.username; // Extract the user ID from the request parameters
  const taskId = req.params.taskId; // Extract the task ID from the request parameters

  const client = await MongoClient.connect(process.env.DB);
  const database = client.db('COP4331');
  const usersCollection = database.collection('Users');
  const tasksCollection = database.collection('Tasks');
  const basketCollection = database.collection('Baskets');

  try {
    // Find the user document by their unique identifier (e.g., username)
    const user = await usersCollection.findOne({ Username: username });

    if (!user) {
      res.status(404).json({ msg: "User not found" });
      return;
    }

    if (!user.Tasks || user.Tasks.length === 0) {
      res.status(404).json({ msg: "User has no tasks" });
      return;
    }

    // Convert taskId to ObjectId for comparison
    const taskObjectId = new ObjectId(taskId);

    // Check if the task ID is in the user's 'Tasks' array
    const taskIndex = user.Tasks.findIndex(task => task.equals(taskObjectId));

    if (taskIndex === -1) {
      res.status(404).json({ msg: "Task not found in the user's Tasks" });
      return;
    }

    // Find the task document to get the ingredient value
    const task = await tasksCollection.findOne({ _id: taskObjectId });

    if (!task) {
      res.status(404).json({ msg: "Task document not found" });
      return;
    }

    const ingredient = task.Ingredient;

    // Remove the task ID from the user's 'Tasks' array
    user.Tasks.splice(taskIndex, 1);

    // Update the user document with the modified 'Tasks' array
    await usersCollection.updateOne({ Username: username }, { $set: { Tasks: user.Tasks } });

    // Find and delete the task document from the 'Tasks' collection
    await tasksCollection.findOneAndDelete({ _id: taskObjectId });

    // Append the ingredient to the user's Basket collection
    await basketCollection.updateOne({ User: username }, { $push: { Ingredients: ingredient } });

    res.json({ msg: "Task deleted from the user's Tasks, removed from the Tasks collection, and ingredient added to the Basket" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Internal server error" });
  } finally {
    await client.close();
  }
});

router.get('/getUserIngredients/:username', async (req, res, next) => {
  const username = req.params.username; // Extract the user ID from the request parameters

  const client = await MongoClient.connect(process.env.DB);
  const database = client.db('COP4331');
  const basketCollection = database.collection('Baskets');

  try {
    // Find the user's basket by their unique identifier (e.g., username)
    const userBasket = await basketCollection.findOne({ User: username });

    if (!userBasket) {
      res.status(404).json({ msg: "User not found in the Basket collection" });
      return;
    }

    const ingredients = userBasket.Ingredients || [];

    res.json({ ingredients });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Internal server error" });
  } finally {
    await client.close();
  }
});

router.get('/getIngredientNames', async (req, res, next) => {
  const client = await MongoClient.connect(process.env.DB);
  const database = client.db('COP4331');
  const ingredientCollection = database.collection('Ingredient');

  try {
    // Find all documents in the 'Ingredient' collection and project only the 'Name' field
    const ingredients = await ingredientCollection.find({}, { projection: { _id: 0, Name: 1 } }).toArray();

    if (ingredients.length === 0) {
      res.status(404).json({ msg: "No ingredients found" });
      return;
    }

    // Extract the 'Name' field from each ingredient and create an array of ingredient names
    const ingredientNames = ingredients.map(ingredient => ingredient.Name);

    res.json(ingredientNames);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Internal server error" });
  } finally {
    await client.close();
  }
});

router.get('/getUserRecipes/:username', async (req, res, next) => {
  const username = req.params.username; // Extract the username from the request parameters

  const client = await MongoClient.connect(process.env.DB);
  const database = client.db('COP4331');
  const usersCollection = database.collection('Users');

  try {
    // Find the user document by their username
    const user = await usersCollection.findOne({ Username: username });

    if (!user) {
      res.status(404).json({ msg: "User not found" });
      return;
    }

    if (!user.Recipes) {
      res.status(404).json({ msg: "User has no recipes" });
      return;
    }

    // Extract the 'Recipes' array from the user document
    const userRecipes = user.Recipes;

    res.json(userRecipes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Internal server error" });
  } finally {
    await client.close();
  }
});

router.get('/getUserTasks/:username', async (req, res, next) => {
  const username = req.params.username; // Extract the user ID from the request parameters
  const client = await MongoClient.connect(process.env.DB);
  const database = client.db('COP4331');
  const usersCollection = database.collection('Users');
  const tasksCollection = database.collection('Tasks');

  try {
    // Find the user document by their unique identifier (e.g., userId)
    const user = await usersCollection.findOne({ Username: username });

    if (!user) {
      res.status(404).json({ msg: `User ${username} not found` });
      return;
  }

  if (!user.Tasks || user.Tasks.length === 0) {
      res.status(404).json({ msg: `User ${username} has no tasks` });
      return;
  }

    // Initialize an array to store task information
    const userTasksInfo = [];

    // Iterate through the 'Tasks' array starting from the second index (index 1)
    for (let i = 0; i < user.Tasks.length; i++) {
      const taskId = user.Tasks[i]; // Get the task ID from the user's 'Tasks' array

      // Find the task document by its ID
      const task = await tasksCollection.findOne({ _id: taskId });

      if (task) {
        userTasksInfo.push(task);
      }
    }

    res.json(userTasksInfo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Internal server error" });
  } finally {
    await client.close();
  }
});

router.get('/getUserTaskDates/:username', async (req, res, next) => {
  const username = req.params.username;

  const client = await MongoClient.connect(process.env.DB);
  const database = client.db('COP4331');
  const usersCollection = database.collection('Users');
  const tasksCollection = database.collection('Tasks');

  try {
    const user = await usersCollection.findOne({ Username: username });

    if (!user) {
      res.status(404).json({ msg: `User ${username} not found` });
      return;
    }

    if (!user.Tasks || user.Tasks.length === 0) {
      res.status(404).json({ msg: `User ${username} has no tasks` });
      return;
    }

    // Initialize an object to store tasks organized by due date
    const userTasksByDueDate = {};

    for (let i = 0; i < user.Tasks.length; i++) {
      const taskId = user.Tasks[i];

      const task = await tasksCollection.findOne({ _id: new ObjectId(taskId) });

      if (task) {
        const dueDate = new Date(task.DueDate).toISOString().split('T')[0];

        if (!userTasksByDueDate[dueDate]) {
          userTasksByDueDate[dueDate] = [];
        }

        userTasksByDueDate[dueDate].push({
          _id: task._id,
          Desc: task.Desc,
          Ingredient: task.Ingredient,
          DueDate: task.DueDate,
          EffortPoints: task.EffortPoints,
        });
      }
    }

    res.json(userTasksByDueDate);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Internal server error' });
  } finally {
    await client.close();
  }
});

router.post('/redeemRecipe/:username/:recipeName', async (req, res, next) => {
  const username = req.params.username; // Extract the user ID from the request parameters
  const recipeName = req.params.recipeName; // Extract the recipe name from the request parameters

  const client = await MongoClient.connect(process.env.DB);
  const database = client.db('COP4331');
  const recipesCollection = database.collection('Recipes');
  const basketsCollection = database.collection('Baskets');
  const usersCollection = database.collection('Users');

  try {
    // Find the recipe document by its name
    const recipe = await recipesCollection.findOne({ Name: recipeName });

    if (!recipe) {
      res.status(404).json({ msg: "Recipe not found" });
      return;
    }

    // Get the ingredients required for the recipe
    const recipeIngredients = recipe.Ingredients;

    // Find the user's basket document by their username
    const userBasket = await basketsCollection.findOne({ User: username });

    if (!userBasket) {
      res.status(404).json({ msg: "User's basket not found" });
      return;
    }

    // Get the ingredients in the user's basket
    const userBasketIngredients = userBasket.Ingredients;

    // Check if the user has sufficient ingredients for the recipe
    const hasSufficientIngredients = recipeIngredients.every(ingredient => userBasketIngredients.includes(ingredient));

    if (!hasSufficientIngredients) {
      res.json({ msg: "Insufficient ingredients" });
      return;
    }

    // Remove the used ingredients from the user's basket
    const updatedBasketIngredients = userBasketIngredients.filter(ingredient => !recipeIngredients.includes(ingredient));

    // Update the user's basket document with the modified 'Ingredients' array
    await basketsCollection.updateOne({ User: username }, { $set: { Ingredients: updatedBasketIngredients } });

    // Access the user document based on the username and append the recipe name to their 'Recipes' array
    await usersCollection.updateOne({ Username: username }, { $push: { Recipes: recipeName } });

    res.json({ msg: "Recipe redeemed successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Internal server error" });
  } finally {
    await client.close();
  }
});

router.get('/getRecipeIngredients/:recipeName', async (req, res, next) => {
  const recipeName = req.params.recipeName; // Extract the recipe name from the request parameters

  const client = await MongoClient.connect(process.env.DB);
  const database = client.db('COP4331');
  const recipesCollection = database.collection('Recipes');

  try {
    // Find the recipe document by its name
    const recipe = await recipesCollection.findOne({ Name: recipeName });

    if (!recipe) {
      res.status(404).json({ msg: "Recipe not found" });
      return;
    }

    // Return the ingredients of the recipe
    res.json(recipe.Ingredients);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Internal server error" });
  } finally {
    await client.close();
  }
});

router.put('/editTask/:taskId', async (req, res, next) => {
  const taskId = req.params.taskId; // Extract the task ID from the request parameters

  const client = await MongoClient.connect(process.env.DB);
  const database = client.db('COP4331');
  const tasksCollection = database.collection('Tasks');

  try {
    // Find the task document by its ID
    const existingTask = await tasksCollection.findOne({ _id: new ObjectId(taskId) });

    if (!existingTask) {
      res.status(404).json({ msg: "Task not found" });
      return;
    }

    // Update the task document with the new values
    await tasksCollection.updateOne(
      { _id: new ObjectId(taskId) },
      {
        $set: {
          Desc: req.body.desc || existingTask.Desc, // Update only if new desc is provided
          Ingredient: req.body.ingredient || existingTask.Ingredient, // Update only if new ingredient is provided
          DueDate: req.body.dueDate ? new Date(req.body.dueDate) : existingTask.DueDate, // Update due date if provided, otherwise keep existing value
          EffortPoints: req.body.effortPoints ? parseInt(req.body.effortPoints) : existingTask.EffortPoints // Update effort points if provided, otherwise keep existing value
        }
      }
    );

    res.json({ msg: "Task edited successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Internal server error" });
  } finally {
    await client.close();
  }
});

router.post('/resetPasswordRequest', async (req, res, next) => {
  const client = await MongoClient.connect(process.env.DB);
  const database = client.db('COP4331');
  const collection = database.collection('Users');
  const collectionResets = database.collection('Reset Codes');
  try {
    const existingUserByEmail = await collection.findOne({ Email: req.body.email });

    if (!existingUserByEmail) {
      res.status(500).json({
        err: "Email is not registered. Please use a different email address."
      });
      return;
    }

    // Generate a verification code
    const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const transporter = nodemailer.createTransport({
        host: 'smtp.zoho.com',
        port: 465,
        secure: true,
      auth: {
          user: 'nodemailer123321@zohomail.com',
          pass: process.env.EMAILPWD,
        },
    });

    await collectionResets.insertOne({
      RestoreID: verificationCode,
      Email: req.body.email,
    });

    // Send verification code via email
    const mailOptions = {
      from: 'nodemailer123321@zohomail.com',
      to: req.body.email,
      subject: 'Veggie Tasks Verification Code',
      text: "To reset your password insert this code: " + verificationCode,
    };
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        res.status(500).json({ err: 'Email sending failed' });
        return;
      } else {
        console.log('Email sent:', info.response);
      }
    });

    res.json({
      success: true,
      message: "Check your email for verification code."
    });

  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.close();
  }
});

router.post('/allowPasswordChange', async (req, res, next) => {
  const client = await MongoClient.connect(process.env.DB);
  const database = client.db('COP4331');
  const usersCollection = database.collection('Users');
  const collectionResets = database.collection('Reset Codes');
  const existingUser = await collectionResets.findOne({ RestoreID: req.body.restoreid });
  if (!existingUser)
  {
    res.status(500).json({ error: "Verification code not found" });
    return;
  }
  await usersCollection.updateOne(
      { Email: existingUser.Email },
      {
        $set: {
          PasswordChangeable: true
        }
      }
    );

  user = await usersCollection.findOne({ Email: existingUser.Email });
  res.json({ msg: "May change password", user });
});

router.post('/changePassword', async (req, res, next) => {
  const client = await MongoClient.connect(process.env.DB);
  const database = client.db('COP4331');
  const usersCollection = database.collection('Users');
  const user = await usersCollection.findOne({ Email: req.body.email })
  if (!user.PasswordChangeable)
  {
    res.status(500).json({ msg: "Cannot change password" });
    return;
  }
  await usersCollection.updateOne(
      { Email: req.body.email },
      {
        $set: {
          Password: req.body.password,
          PasswordChangeable: false
        }
      }
    );
  res.json({ msg: "Password Changed" });
});

router.get('/searchTaskByName/:username/:taskName', async (req, res, next) => {
  const username = req.params.username; // Extract the username from the request parameters
  const taskName = req.params.taskName; // Extract the task name from the request parameters

  const client = await MongoClient.connect(process.env.DB);
  const database = client.db('COP4331');
  const tasksCollection = database.collection('Tasks');

  try {
    // Use a regular expression for a case-insensitive partial match search
    const regex = new RegExp(taskName, 'i');

    // Search for the task documents with names that partially match the provided name and belong to the specified username
    const matchingTasks = await tasksCollection.find({ User: username, Desc: { $regex: regex } }).toArray();

    if (matchingTasks.length === 0) {
      res.status(404).json({ msg: "No matching tasks found for the specified username and task name" });
      return;
    }

    // Return the found task documents
    res.json(matchingTasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Internal server error" });
  } finally {
    await client.close();
  }
});

router.get('/searchTaskByDueDate/:username/:dueDate', async (req, res, next) => {
  const username = req.params.username; // Extract the username from the request parameters
  const dueDate = req.params.dueDate; // Extract the due date from the request parameters

  const client = await MongoClient.connect(process.env.DB);
  const database = client.db('COP4331');
  const tasksCollection = database.collection('Tasks');

  try {
    // Search for the task documents with due dates that match the provided due date and belong to the specified username
    const matchingTasks = await tasksCollection.find({ User: username, DueDate: dueDate }).toArray();

    if (matchingTasks.length === 0) {
      res.status(404).json({ msg: "No matching tasks found for the specified username and due date" });
      return;
    }

    // Return the found task documents
    res.json(matchingTasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Internal server error" });
  } finally {
    await client.close();
  }
});

// Add CORS middleware to allow requests from any origin (you can configure this to be more restrictive)
router.use(cors());

module.exports = router;
