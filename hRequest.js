var hRequest = { }
var querystring = require('querystring');
var http = require('http');
var https = require('https');
var url = require('url');
var adehun = require('Adehun');

hRequest.post = function(href, params){
	var params = querystring.stringify(params);
	var rString = '';
	var opt = url.parse(href);
	var proto;
	if(opt.protocol == 'http:'){
		proto = http;
	} else if(opt.protocol == 'https:'){
		proto = https;
	}
	opt.method = 'POST';
	opt.headers = {
		'Content-Type' : 'application/x-www-form-urlencoded',
		'Content-Length' : params.length,
		'User-Agent' : 'MinusFour'
	}

	var dProm = adehun.deferred();
	var req = proto.request(opt, function(res){
		res.setEncoding('utf8');
		res.on('data', function(data){
			rString += data;
		});

		res.on('end', function(){
			dProm.resolve({
				code : res.statusCode,
				headers : res.headers,
				answer : rString
			});
		});
	});
	req.on('error', function(e){
		dProm.reject(e);
	});

	req.write(params);
	req.end();
	return dProm.promise;
}

module.exports = hRequest;
