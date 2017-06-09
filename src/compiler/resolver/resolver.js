const AST = require("../AST")
const { ValueType, ValueTypeStr } = require("../types")
const logger = require("../../logger")

let activeScope = null

const run = function(file) {
	parse.BlockDeclaration(file.blockNode)
}

const parse =
{
	Number(node) {
		return node.valueType
	},

	String(node) {
		return node.valueType
	},

	Identifier(node) 
	{
		const variable = activeScope.vars[node.value]
		if(!variable) {
			logger.logError("IdentifierError:", `‘${node.value}’ was not declared in this scope`)
			return 0
		}
		
		return ValueType.valueType
	},

	BlockDeclaration(node)
	{
		const prevScope = activeScope
		activeScope = node.scope

		const body = node.scope.body
		for(let n = 0; n < body.length; n++) {
			const bodyNode = body[n]
			parse[bodyNode.type](bodyNode)
		}

		activeScope = prevScope
	},

	Variable(node) 
	{
		const exprValueType = parse[node.expr.type](node.expr)

		if(node.valueType && node.valueType !== exprValueType) {
			logger.logError("TypeError", `invalid conversion from '${ValueTypeStr[node.valueType]}' to '${ValueTypeStr[exprValueType]}'`)
			return
		}

		node.valueType = exprValueType
	},

	VariableDeclaration(node)
	{
		const decls = node.decls
		for(let n = 0; n < decls.length; n++) {
			const decl = decls[n]
			parse[decl.type](decl)
			activeScope.vars[decl.id.value] = decl
		}
	},

	AssignmentExpression(node) 
	{
		const leftType = parse[node.left.type](node.left)
		const rightType = parse[node.right.type](node.right)

		if(leftType && leftType !== rightType) {
			logger.logError("TypeError", `invalid conversion from '${ValueTypeStr[leftType]}' to '${ValueTypeStr[rightType]}'`)
			return
		}
		else {
			node.valueType = leftType
		}

		return node.valueType
	},

	BinaryExpression(node) 
	{
		const leftType = parse[node.left.type](node.left)
		const rightType = parse[node.right.type](node.right)

		if(leftType === ValueType.String || rightType === ValueType.String) {
			node.valueType = ValueType.String
		}
		else {
			node.valueType = leftType
		}

		return node.valueType
	},

	FunctionDeclaration(node) 
	{
		const scopeNode = activeScope.vars[node.id.value]
		if(scopeNode) {
			logger.logError("Error", `redeclaration of ${node.id.value}:${node.typeValue}`)
			return
		}

		activeScope.vars[node.id.value] = node

		parse.BlockDeclaration(node.body)
	}
}

const getName = function(node)
{
	switch(node.type)
	{
		case "Identifier":
			return node.value
	}

	return null
}

module.exports = {
	run
}