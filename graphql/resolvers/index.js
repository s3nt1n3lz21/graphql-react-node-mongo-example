const Event = require('../../models/event');
const User = require('../../models/user');
const bcrypt = require('bcryptjs');

// When we save data to the database we save the Ids other referenced objects,
// but when we query for data using GraphQL we use the below functions to find and
// return the whole object not just the id.

// Find a User object by userId
// const user = userId => {
//     return User.findById(userId)
//         .then(user => {
//             return { 
//                 ...user._doc,
//                 createdEvents: events.bind(this, user._doc.createdEvents)
//             }
//         })
//         .catch(err => {
//             throw err
//         })
// }

// Using async/await
const user = async userId => {
    try {
        const user = await User.findById(userId)
        return { 
            ...user._doc,
            createdEvents: events.bind(this, user._doc.createdEvents)
        }
    } catch (err) {
        throw err
    }
}

// Find all the Event objects in a list of eventIds and return the whole User object for the creator
// const events = eventIds => {
//     return Event.find({ _id: {$in: eventIds}})
//         .then(events => {
//             return events.map(event => {
//                 return { 
//                     ...event._doc,
//                     date: new Date(event._doc.date).toISOString(),
//                     creator: user.bind(this, event.creator)
//                 }
//             })
//         })
//         .catch(err => {
//             throw err;
//         })
// }

// Using async/await
const events = async eventIds => {
    try {
        const events = await Event.find({ _id: {$in: eventIds}})
        return events.map(event => {
                    return { 
                        ...event._doc,
                        date: new Date(event._doc.date).toISOString(),
                        creator: user.bind(this, event.creator)
                    }
        })
    } catch (err) {
        throw err;
    }
}

module.exports = {
    events: async () => {
        try {
            // Find the Event objects and return the whole User Object
            const events = await Event.find()
            return events.map(event => { 
                // Return the events without all the metadata
                // Make sure date is returned as an ISOString
                return { 
                    ...event._doc,
                    date: new Date(event._doc.date).toISOString(),
                    creator: user.bind(this, event._doc.creator)
                } 
            })
        } catch (err) {
            throw err;
        }
    },
    createEvent: async (args) => {
        const event = new Event({
            title: args.eventInput.title,
            description: args.eventInput.description,
            price: +args.eventInput.price,
            date: new Date(args.eventInput.date),
            creator: "61c1e2d68ea87ad214135ae0"
        });
        let createdEvent;
        try {
            // Save the event to MongoDB
            const result = await event.save()
            createdEvent = { 
                ...result._doc, 
                date: new Date(event._doc.date).toISOString(),
                creator: user.bind(this, result._doc.creator)
            };

            // Add the event to the users 
            const creator = await User.findById("61c1e2d68ea87ad214135ae0")
            if (!creator) {
                throw new Error("Cannot add an event to a user that doesnt exist!")
            }

            // Should be the event id, but its smart enough to grab just the id
            creator.createdEvents.push(event);

            // Update the user
            await creator.save();

            // Return the event without the metadata
            return createdEvent;
        } catch (err) {
            console.error(err);
            throw err;
        }
    },
    createUser: async args => {
        try {
            // Check a user with this email doesn't already exist
            const existingUser = await User.findOne({ email: args.userInput.email })
                
            if (existingUser) {
                throw new Error('User already exists.')
            }
            // Create a new user but encrypt the password
            const hashedPassword = await bcrypt.hash(args.userInput.password, 12)

            const user = new User({
                email: args.userInput.email,
                password: hashedPassword
            });
            const result = await user.save();

            // When returning the user, return a null password
            return { ...result._doc, password: null }
            } catch (err) {
                throw err
            }
    }
}