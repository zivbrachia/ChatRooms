var restify = require('restify');
var fs = require('fs');
var socket = require('socket.io');
var session = require('client-sessions');
//
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 1234, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
//
server.use(restify.queryParser());
//
server.use(session({
	cookieName: 'session',
	secret: 'random_string_goes_here',
	duration: 30 * 60 * 1000,
	activeDuration: 5 * 60 * 1000,
}));
//
var io = socket.listen(server.server);
//
server.get('/', function(req, res, next) {
	fs.readFile(__dirname + '/index.html', function (err, data) {
        if (err) {
            next(err);
            return;
        }

        res.setHeader('Content-Type', 'text/html');
        res.writeHead(200);
        res.end(data);
        next();
    });
    return next();
});

server.get('/login/:loginQuery', function(req, res, next) {
	fs.readFile(__dirname + '/login.html', function (err, data) {
        if (err) {
            next(err);
            return;
        }

        res.setHeader('Content-Type', 'text/html');
        res.writeHead(200);
        res.end(data);
        next();
    });
    return next();
});

server.get('/createChat/:chatId', function(req, res, next) {
	var status = null;
	var socketId = null; 
	var chatId = req.params.chatId;
	//
	var user = getAvailableUser();
	//
	socketId = user.socketId;
	if(typeof(io.sockets.adapter.rooms[socketId])!=='undefined') {
		status = "ok";
	} else {
		socketId = null;
		chatId = null;
		status = null;
	}
	res.setHeader('Content-Type', 'application/json');
	res.writeHead(200);
	if ((user==null)||(status==null)) {
		res.end('{"socketId":"'+ socketId +'", "chatId":"'+ chatId +'", "username":"'+ user.username +'", "status":"'+status+'"}');
		return;	
	} else {
		res.end('{"socketId":"'+ socketId +'", "chatId":"'+ chatId +'", "username":"'+ user.username +'", "status":"'+status+'"}');
	}
	user.chats.push(chatId);
	rooms.push(chatId);
	io.sockets.emit('updaterooms', rooms, 'waitingRoom');
	io.sockets.in(socketId).emit('switchRoom', chatId);
	//
	var userSocket = io.sockets.sockets[socketId];
	userSocket.join(chatId);
	io.sockets.emit('updateusers', usernames, user.username);
	userSocket.emit("updateStatus",user);
});

server.get('/sendMessage/:room/:username/:msg', function(req, res, next) {
	var status = null;
	if(typeof(io.sockets.adapter.rooms[req.params.room])!=='undefined') {
		io.sockets.in(req.params.room).emit('updatechat', req.params.username, req.params.msg);
		status = "ok";
	}
	res.setHeader('Content-Type', 'application/json');
	res.writeHead(200);
	res.end('{"room":"'+ req.params.room +'", "username":"'+ req.params.username +'", "msg":"'+ req.params.msg +'", "status":"'+status+'"}');
});

// usernames which are currently connected to the chat
var usernames = {
	"users":[]
};
// rooms which are currently available in chat
var rooms = ['waitingRoom'];

io.sockets.on('connection', function (socket) {
	
	// when the client emits 'adduser', this listens and executes
	socket.on('adduser', function(username){
		// store the username in the socket session for this client
		socket.username = username;
		// store the room name in the socket session for this client
		socket.room = 'waitingRoom';
		console.log(socket.id + " " + username);
		// add the client's username to the global list
		var user = {"username":username, "socketId":socket.id, "chats": []}
		usernames.users.push(user);
		// send client to room 1
		socket.join('waitingRoom');
		// echo to client they've connected
		////socket.emit('updatechat', 'SERVER', 'you have connected to waitingRoom');
		// echo to room 1 that a person has connected to their room
		////socket.broadcast.to('waitingRoom').emit('updatechat', 'SERVER', username + ' has connected to this room');
		//
		socket.emit('updaterooms', rooms, 'waitingRoom');
		io.sockets.emit('updateusers', usernames, username);
		socket.emit("updateStatus",user);
	});
	
	// when the client emits 'sendchat', this listens and executes
	socket.on('sendchat', function (data) {
		// we tell the client to execute 'updatechat' with 2 parameters
		console.log(socket.id + "*" + socket.room);
		io.sockets.in(socket.room).emit('updatechat', socket.username, data);
		//io.sockets.in(socket.room).emit('updateroom',socket.room)
	});
	
	socket.on('subscribe', function(room) {
		socket.join(room);
	});

	socket.on('unsubscribe', function(room) {
        socket.leave(room); 
    });

	socket.on('switchRoom', function(newroom){
		console.log("ASdf");
		////socket.leave(socket.room);
		////socket.join(newroom);
		socket.emit('updatechat', 'SERVER', 'you have connected to '+ newroom);
		// sent message to OLD room
		////socket.broadcast.to(socket.room).emit('updatechat', 'SERVER', socket.username+' has left this room');
		// update socket session room title
		////socket.room = newroom;
		socket.broadcast.to(newroom).emit('updatechat', 'SERVER', socket.username+' has joined '+ newroom +' room');
		socket.emit('updaterooms', rooms, newroom);
	});
	

	// when the user disconnects.. perform this
	socket.on('disconnect', function(){
		// remove the username from global usernames list
		delete usernames[socket.username];
		// update list of users in chat, client-side
		io.sockets.emit('updateusers', usernames);
		// echo globally that this client has left
		socket.broadcast.emit('updatechat', 'SERVER', socket.username + ' has disconnected');
		socket.leave(socket.room);
	});
});

function getAvailableUser() {
	var maxChats = 2;
	var retUser = null;
	usernames.users.forEach(function(user) {
		if (user.chats.length < maxChats) {
			retUser = user;
			return;
		} else {

		}
	}, this);
	return retUser;
}