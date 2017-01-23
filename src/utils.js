function logGreen(type, text) {
	console.log(createTimestamp(), "\x1b[92m" + type, "\x1b[0m" + (text || ""));	
}

function logYellow(type, text) {
	console.log(createTimestamp(), "\x1b[33m" + type, "\x1b[0m" + (text || ""));	
}

function logMagenta(type, text) {
	console.log(createTimestamp(), "\x1b[35m" + type, "\x1b[0m" + (text || ""));	
}

function logError(type, text) {
	console.log(createTimestamp(), "\x1b[91m" + type, "\x1b[0m"  + (text || ""));	
}

function createTimestamp() 
{
	const date = new Date();
	const hour = date.getHours();
	const minutes = date.getMinutes();
	const seconds = date.getSeconds();
	const milliseconds = date.getMilliseconds();

	return "[" +
		((hour < 10) ? "0" + hour: hour) +
		":" +
		((minutes < 10) ? "0" + minutes: minutes) +
		":" +
		((seconds < 10) ? "0" + seconds: seconds) +
		"]";
}

module.exports = {
	logGreen, logYellow, logMagenta, logError, createTimestamp
};
