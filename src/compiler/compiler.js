const targets = {
	js: require("./target/target-js"),
	wast: require("./target/target-wast")
}

const compile = function(file, flags)
{
	if(!flags)
	{
		flags = {
			type: "content",
			target: "js"
		}
	}

	switch(flags.type)
	{
		case "imports":
			return targets.js.compileImports(flags, file)

		case "content":
			return targets[flags.target].compile(flags, file)
	}
}

module.exports = {
	compile
}