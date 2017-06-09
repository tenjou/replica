
const ValueType = {}
const ValueTypeStr = {}
let freeTypeId = 0

const type = function(type) {
	ValueType[type] = freeTypeId
	ValueTypeStr[freeTypeId] = type
	freeTypeId++
}

type("Dynamic")
type("Number")
type("String")
type("Function")

module.exports = {
	ValueType,
	ValueTypeStr
}