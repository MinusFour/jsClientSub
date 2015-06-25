var http = require('http');
var url = require('url');
var hRequest = require('./hRequest');
var querystring = require('querystring');
var subscriptions = require('./subscriptions');

ClientSub.prototype.subscribe = function(cbPath, subName, hub, topic){
	if(!this._subscriptions.subExists(subName)){
		var sub = this._subscriptions.add(cbPath, subName, hub, topic);
		var that = this;
		hRequest.post(hub, {
			'hub.verify' : 'sync',
			'hub.mode' : 'subscribe',
			'hub.topic' : topic,
			'hub.callback' : 'http://' + this._host + cbPath
		}).then(function(data){
			console.log(data);
			if(data.code === 204 || data.code === 202){
				trigger.call(that, 'subscribeSuccess');
				sub.markSubscribed();
			} else {
				console.log('[Unexpected answer]');
				console.log(data);
			}
		});
	}
}

ClientSub.prototype.unsubscribe = function(subName){
	if(this._subscriptions.subExists(subName)){
		var sub = this._subscriptions.getSubByName(subName);
		var that = this;
		sub.markUnsubscribing();
		hRequest.post(sub._hub, {
			'hub.verify' : 'sync',
			'hub.mode' : 'unsubscribe',
			'hub.topic' : sub._topic,
			'hub.callback' : 'http://' + this._host + sub._path
		}).then(function(data){
			console.log(data.code);
			if(data.code === 204 || data.code === 202){
				sub.markUnsubscribed();
			} else {
				console.log('[Unexpected answer]');
				console.log(data);
			}
		});
	}
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
				if(subscription.isValidating() && Object.keys(params.query).length > 0){
						res.write(params.query['hub.challenge']);
					} else if(req.headers['X-Hub-Signature'] === undefined || subscription.auth(req.headers['X-Hub-Signature'])) {
						res.writeHead(200, { 'Accept' : 'application/json' });
						if(req.headers['content-type']){
							if(req.headers['content-type'] == 'application/json'){
								try {
									var msgObj = JSON.parse(msg);
									trigger.call(that, 'update', subscription._name, 'json', msgObj);
								} catch (e){
									console.log('Malformed JSON data');
								}
							} else if(req.headers['content-type'] == 'application/x-www-form-urlencoded'){
								try {
									var msgObj = querystring.parse(msg);
									trigger.call(that, 'update', subscription._name, 'post', msgObj);
								}catch(e){
									console.log('Malformed POST data');
								}
							}
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
