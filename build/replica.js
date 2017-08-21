
(function() 
{
	var connection = new WebSocket("ws://127.0.0.1:" + REPLICA_SERVER_PORT, [ "soap", "xmpp" ]);
	connection.onopen = function() {
		console.log("(replica) Connected to development server");
	};
	connection.onerror = function(error) {
		console.log("(replica) Error:", error);
	};
	connection.onmessage = function(event) {
		document.location.reload();
	};
})();