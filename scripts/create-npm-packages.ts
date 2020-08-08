import * as path from "https://deno.land/std/path/mod.ts";
import {parse} from "./vendor/node-jsonc-parser/jsonc.ts"

for await (const tsconfigEntry of Deno.readDir("bases")) {
  if (!tsconfigEntry.isFile) continue
  
  const tsconfigFilePath = path.join("bases", tsconfigEntry.name)
  const name = path.basename(tsconfigEntry.name).replace(".json", "")

  // Make the folder
  const packagePath = path.join("packages", name)
  Deno.mkdirSync(packagePath, { recursive: true })

  // Copy over the template files
  const templateDir = "./template"
  for await (const templateFile of Deno.readDir(templateDir)) {
    if (!templateFile.isFile) continue
    const templatedFile = path.join(templateDir, templateFile.name)
    Deno.copyFileSync(templatedFile, path.join(packagePath, templateFile.name))
  }
  
  // Copy the create a tsconfig.json from the base json
  const newPackageTSConfigPath = path.join(packagePath, "tsconfig.json")
  Deno.copyFileSync(tsconfigFilePath, newPackageTSConfigPath)
  
  const tsconfigText = await Deno.readTextFile(newPackageTSConfigPath)
  const tsconfigJSON = parse(tsconfigText)

  // Edit the package.json
  const packageText = await Deno.readTextFile(path.join(packagePath, "package.json"))
  const packageJSON = JSON.parse(packageText)
  packageJSON.name = `@tsconfig/${name}`
  packageJSON.description = `A base TSConfig for working with ${tsconfigJSON.display}.`

  // Do some string replacements in the other templated files
  const replaceTextIn = ["README.md"]
  for (const filenameToEdit of replaceTextIn) {
    const fileToEdit =  path.join(packagePath, filenameToEdit)
  
    const defaultTitle = `A base TSConfig for working with ${tsconfigJSON.display}`
    const title = name !== "recommended" ? defaultTitle : "The recommended base for a TSConfig"

    let packageText = await Deno.readTextFile(fileToEdit)
    packageText = packageText.replace(/\[filename\]/g, name)
                             .replace(/\[display_title\]/g, title)
                             .replace(/\[tsconfig\]/g, Deno.readTextFileSync(tsconfigFilePath))

    await Deno.writeTextFile(fileToEdit, packageText)
  };

  // Bump the last version of the number from npm, or default to 1.0.0
  let version = "1.0.0"
  try {
    const npmResponse = await fetch(`https://registry.npmjs.org/${packageJSON.name}`)
    const npmPackage = await npmResponse.json()

    const semverMarkers = npmPackage["dist-tags"].latest.split(".");
    version = `${semverMarkers[0]}.${semverMarkers[1]}.${Number(semverMarkers[2]) + 1}`;
  } catch (error) {
    // NOOP, this is for the first deploy 
    // console.log(error)
  }
  
  packageJSON.version = version
  await Deno.writeTextFile(path.join(packagePath, "package.json"), JSON.stringify(packageJSON))

  console.log("Built:", tsconfigEntry.name);
}

