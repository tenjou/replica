const AST = require("../AST")
const logger = require("../../logger")

let activeScope = null

const run = function(file) {
	parse.Block(file.blockNode)
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

	Block(node)
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

	BinaryExpression(node)
	{
		const leftNode = parse[node.left.type](node.left)
		const rightNode = parse[node.right.type](node.right)

		leftNode.value += rightNode.value
		if(leftNode.type === "String") {
			leftNode.raw = `"${leftNode.value}"`
		}

		return leftNode
	}		
}

module.exports = {
	run
}