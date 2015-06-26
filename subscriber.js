var http = require('http');
var url = require('url');
var hRequest = require('./hRequest');
var querystring = require('querystring');
var subscriptions = require('./subscriptions');

ClientSub.prototype.subscribe = function(subOptions, clientOptions, acceptHeaders){
	if(subOptions.name !== undefined && !this._subscriptions.subExists(subOptions.name)){
		if(subOptions.path !== undefined && subOptions.hub !== undefined && subOptions.topic !== undefined){
			acceptHeaders = acceptHeaders !== undefined ? acceptHeaders : { };
			clientOptions = clientOptions !== undefined ? clientOptions : { };
			var sub = this._subscriptions.add(subOptions, clientOptions, acceptHeaders);
			handleRequest.call(this, sub, 'subscribe');
		}
	}
}

ClientSub.prototype.unsubscribe = function(subName){
	if(this._subscriptions.subExists(subName)){
		var sub = this._subscriptions.getSubByName(subName);
		handleRequest.call(this, sub, 'unsubscribe');
	}
}

function handleRequest(sub, mode){
	var subOptions = sub.subOptions;
	var clientOptions = sub.clientOptions;
	var postData = {
		'hub.verify' : 'sync',
		'hub.topic' : subOptions.topic,
		'hub.callback' : 'http://' + this._host + subOptions.path
	}

	postData['hub.mode'] = mode;

	if(mode == 'unsubscribing'){
		sub.markUnsubscribing();
	}

	if(subOptions.secret !== undefined){
		postData['hub.secret'] = subOptions.secret;
	}
	if(clientOptions.extraData !== undefined && typeof clientOptions.extraData === 'object'){
		for(param in clientOptions.extraData){
			postData[param] = clientOptions.extraData[param];
		}
	}
	var httpRequest;
	if(clientOptions.extraHeaders !== undefined && typeof clientOptions.extraHeaders === 'object') {
		httpRequest = hRequest.post(subOptions.hub, postData, clientOptions.extraHeaders);
	} else {
		httpRequest = hRequest.post(subOptions.hub, postData);
	}

	httpRequest.then(function(data){
		if(data.code === 204 || data.code === 202){
			if(mode == 'subscribe'){
				sub.markSubscribed();
			} else {
				sub.markUnsubscribed();
			}
		} else {
			console.log('[Unexpected answer]');
			console.log(data);
		}
	});

}

function trigger(event){
	var args = [].slice.call(arguments, 1);
	if(this._events[event]){
		this._events[event].forEach(function(fn){
			fn.apply(null, args);
		});
	}
}

ClientSub.prototype.on = function(event, fn){
	if(this._events[event] === undefined){
		this._events[event] = [];
	}
	this._events[event].push(fn);
}

function ClientSub(host, dir, httpServer){
	if(httpServer !== undefined){
		this._server = httpServer;
	} else {
		//Init server
		this._server = http.createServer();
	}
	var that = this;
	this._server.on('request', function(req, res){
		req.setEncoding('utf8');
		var params = url.parse(req.url, true);
		var msg = '';
		req.on('data', function(data){
			msg += data;
		});
		req.on('end', function(){
			var subscription = that._subscriptions.getSubByPath(params.pathname);
			if(subscription){
				if((subscription.isValidating() || subscription.isUnsubscribing()) && Object.keys(params.query).length > 0){
						res.write(params.query['hub.challenge']);
					} else {
						res.writeHead(200, subscription.acceptHeaders);
						if(req.headers['X-Hub-Signature'] === undefined || subscription.auth(req.headers['X-Hub-Signature'])) {
							if(req.headers['content-type']){
								if(req.headers['content-type'] == 'application/json'){
									try {
										var msgObj = JSON.parse(msg);
										trigger.call(that, 'update', subscription, 'json', msgObj, req.headers);
									} catch (e){
										console.log('Malformed JSON data');
									}
								} else if(req.headers['content-type'] == 'application/x-www-form-urlencoded'){
									try {
										var msgObj = querystring.parse(msg);
										trigger.call(that, 'update', subscription, 'post', msgObj, req.headers);
									}catch(e){
										console.log('Malformed POST data');
									}
								}
							}
						} else {
							console.log('Auth Failed');
						}
					}
			} else {
				res.writeHead(404);
			}
			res.end();
		});
	});
	this._subscriptions = subscriptions.load(dir);
	//Hostname
	this._host = host;
	this._events = { };
}

ClientSub.prototype.listen = function(port){
	//Listen on port
	this._server.listen(port);

}

module.exports = {
	load : function(host, dir){
		return new ClientSub(host, dir);
	}
}
