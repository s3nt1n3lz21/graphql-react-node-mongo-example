const express = require('express');
const bodyParser = require('body-parser');
const { graphqlHTTP } = require('express-graphql');
const { buildSchema } = require('graphql');
const mongoose = require('mongoose');

const Event = require('./models/event');
const User = require('./models/user');
const bcrypt = require('bcryptjs');

const app = express();

app.use(bodyParser.json());

// When we save data to the database we save the Ids other referenced objects,
// but when we query for data using GraphQL we use the below functions to find and
// return the whole object not just the id.

// Find a User object by userId
const user = userId => {
    return User.findById(userId)
        .then(user => {
            return { 
                ...user._doc,
                createdEvents: events.bind(this, user._doc.createdEvents)
            }
        })
        .catch(err => {
            throw err
        })
}

// Find all the Event objects in a list of eventIds and return the whole User object for the creator
const events = eventIds => {
    return Event.find({ _id: {$in: eventIds}})
        .then(events => {
            return events.map(event => {
                return { 
                    ...event._doc, 
                    creator: user.bind(this, event.creator)
                }
            })
        })
        .catch(err => {
            throw err;
        })
}

// ! means required, cannot return a null value. A list of null values or just a null response
// Don't want to be able to get the password for a User so we don't put required!

app.use('/graphql', graphqlHTTP({
    schema: buildSchema(`
        type Event {
            _id: ID!
            title: String!
            description: String!
            price: Float!
            date: String!
            creator: User!
        }

        type User {
            _id: ID!
            email: String!
            password: String
            createdEvents: [Event!]
        }

        input EventInput {
            title: String!
            description: String!
            price: Float!
            date: String!
        }

        input UserInput {
            email: String!
            password: String!
        }

        type RootQuery {
            events: [Event!]!
        }

        type RootMutation {
            createEvent(eventInput: EventInput): Event
            createUser(userInput: UserInput): User
        }

        schema {
            query: RootQuery
            mutation: RootMutation
        }
    `),
    rootValue: {
        events: () => {
            // Find the Event objects and return the whole User Object
            return Event.find()
            .then(events => {
                return events.map(event => { 
                    // Return the events without all the metadata
                    return { 
                        ...event._doc,
                        creator: user.bind(this, event._doc.creator)
                    } 
                })
            })
            .catch(err => {
                throw err
            })
        },
        createEvent: (args) => {
            const event = new Event({
                title: args.eventInput.title,
                description: args.eventInput.description,
                price: +args.eventInput.price,
                date: new Date(args.eventInput.date),
                creator: "61c1e2d68ea87ad214135ae0"
            });
            let createdEvent;
            // Save the event to MongoDB
            return event.save()
                .then(result => {
                    createdEvent = { 
                        ...result._doc, 
                        creator: user.bind(this, result._doc.creator)
                    };
                    // Add the event to the users 
                    return User.findById("61c1e2d68ea87ad214135ae0")
                })
                .then(user => {
                    if (!user) {
                        throw new Error("Cannot add an event to a user that doesnt exist!")
                    }
                    // Should be the event id, but its smart enough to grab just the id
                    user.createdEvents.push(event);
                    // Update the user
                    return user.save();
                })
                .then(result => {
                    // Return the event without the metadata
                    return createdEvent;
                })
                .catch(err => {
                    console.error(err);
                    throw err;
                });
        },
        createUser: args => {
            // Check a user with this email doesn't already exist
            return User.findOne({ email: args.userInput.email })
                .then(user => {
                    if (user) {
                        throw new Error('User already exists.')
                    }
                    // Create a new user but encrypt the password
                    return bcrypt.hash(args.userInput.password, 12)
                })
                .then(hashedPassword => {
                    const user = new User({
                        email: args.userInput.email,
                        password: hashedPassword
                    });
                    return user.save();
                })
                // When returning the user, return a null password
                .then(result => {
                    return { ...result._doc, password: null }
                })
                .catch(err => {
                    throw err
                });
        }
    },
    graphiql: true
}))

mongoose.connect(`mongodb+srv://${process.env.MONGO_USER}:${encodeURIComponent(process.env.MONGO_PASSWORD)}@cluster0.a8cjy.mongodb.net/${process.env.MONGO_DB}?retryWrites=true&w=majority`)
.then(() => {
    app.listen(3000);
})
.catch(err => {
    console.error(err);
});