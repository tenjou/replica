const AST = require("../AST")
const { ValueType } = require("../types")
const logger = require("../../logger")

let activeScope = null

const run = function(file) {
	parse.BlockDeclaration(file.blockNode)
}

const parse = 
{
	Number(node) {
		return node
	},

	String(node) {
		return node
	},

	Identifier(node) {
		return node
	},

	BlockDeclaration(node)
	{
		activeScope = node.scope

		const body = node.scope.body
		for(let n = 0; n < body.length; n++) {
			const bodyNode = body[n]
			const resultNode = parse[bodyNode.type](bodyNode)
			body[n] = resultNode
		}
	},

	Variable(node) {
		node.expr = parse[node.expr.type](node.expr)
		return node
	},

	VariableDeclaration(node)
	{
		const decls = node.decls
		for(let n = 0; n < decls.length; n++) {
			const decl = decls[n]
			parse[decl.type](decl)
		}

		return node
	},

	Expression(node)
	{
		const leftNode = parse[node.left.type](node.left)
		const rightNode = parse[node.right.type](node.right)

		if(rightNode.valueType === ValueType.String) {
			rightNode.value = leftNode.value + rightNode.value
			rightNode.raw = `"${rightNode.value}"`
			return rightNode
		}
		
		leftNode.value += rightNode.value
		return leftNode
	},

	AssignmentExpression(node) {
		node.right = parse[node.right.type](node.right)
		return node
	},

	BinaryExpression(node) {
		return parse.Expression(node)
	},

	FunctionDeclaration(node) {
		parse.BlockDeclaration(node.body)
		return node
	}	
}

module.exports = {
	run
}