
const logGreen = (type, text) => {
	console.log(createTimestamp(), "\x1b[92m" + type, "\x1b[0m" + (text || ""))	
}

const logYellow = (type, text) => {
	console.log(createTimestamp(), "\x1b[33m" + type, "\x1b[0m" + (text || ""))	
}

const logMagenta = (type, text) => {
	console.log(createTimestamp(), "\x1b[35m" + type, "\x1b[0m" + (text || ""))
}

const logError = (type, text) => {
	console.log(createTimestamp(), "\x1b[91m" + type, "\x1b[0m"  + (text || ""))
}

const createTimestamp = () => {
	const date = new Date()
	const hour = date.getHours()
	const minutes = date.getMinutes()
	const seconds = date.getSeconds()
	const milliseconds = date.getMilliseconds()

	return "[" +
		((hour < 10) ? "0" + hour: hour) +
		":" +
		((minutes < 10) ? "0" + minutes: minutes) +
		":" +
		((seconds < 10) ? "0" + seconds: seconds) +
		"]"
}

const raise = function(msg) {
	const error = new Error(msg)
	throw error
}

module.exports = {
	logGreen, logYellow, logMagenta, logError, createTimestamp, raise
}
