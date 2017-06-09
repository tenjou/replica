const AST = require("../AST")
const { ValueTypeStr } = require("../types")
const logger = require("../../logger")

let activeScope = null

const run = function(file) {
	parse.Block(file.blockNode)
}

const parse =
{
	Number(node) {
		return node.valueType
	},

	String(node) {
		return node.valueType
	},

	Identifier(node) {
		const variable = activeScope.vars[node.value]
		return variable.valueType
	},

	Block(node)
	{
		activeScope = node.scope

		const body = node.scope.body
		for(let n = 0; n < body.length; n++) {
			const bodyNode = body[n]
			parse[bodyNode.type](bodyNode)
		}
	},

	Variable(node) 
	{
		const exprValueType = parse[node.expr.type](node.expr)

		if(node.valueType !== exprValueType) {
			logger.logError("TypeError", `invalid conversion from '${ValueTypeStr[node.valueType]}' to '${ValueTypeStr[exprValueType]}'`)
			return
		}

		const scopeVar = activeScope.vars[node.id.value]
		if(scopeVar && scopeVar.valueType && scopeVar.valueType !== nodeValueType) {
			logger.logError("TypeError", `invalid conversion from '${ValueTypeStr[node.valueType]}' to '${ValueTypeStr[exprValueType]}'`)
			return
		}
		else {
			node.valueType = nodeValueType
		}
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

	BinaryExpression(node)
	{
		const leftType = parse[node.left.type](node.left)
		const rightType = parse[node.right.type](node.right)

		if(leftType === AST.ValueType.STRING || rightType === AST.ValueType.STRING) {
			node.valueType = AST.ValueType.STRING
		}
		else {
			node.valueType = leftType
		}

		return node.valueType
	}
}

module.exports = {
	run
}