import ts from "typescript";
import type { SourceFile } from "../source-files.js";
import { DEFAULT_DATABASE_NAME, DEFAULT_IMPLEMENTATION, type ImplementationOptions } from "./options.js";
import { findExportedFunctions, formatHit, parseFiles } from "./syntax.js";

export interface DatabaseHandleOptions extends ImplementationOptions {
  /** The name of the injectable handle. Default: {@link DEFAULT_DATABASE_NAME} (`database` or `db`). */
  databaseName?: RegExp;
}

/**
 * Rule 4: every function an implementation module exports takes an injectable database handle, so a
 * test runs it on PGlite: a parameter with the handle's name, a destructured option
 * (`{ database }`), or an options parameter whose type (a type literal, or an interface or type alias
 * declared in the same file) has the handle as a member.
 */
export function findImplementationsWithoutDatabase(files: readonly SourceFile[], options: DatabaseHandleOptions = {}): string[] {
  const implementation = options.implementation ?? DEFAULT_IMPLEMENTATION;
  const databaseName = options.databaseName ?? DEFAULT_DATABASE_NAME;
  return parseFiles(files.filter(({ file }) => implementation.test(file))).flatMap((parsed) =>
    findExportedFunctions(parsed.tree)
      .filter(({ node }) => !node.parameters.some((parameter) => takesDatabase(parsed.tree, parameter, databaseName)))
      .map(({ name, node }) =>
        formatHit(parsed, node, `implementation ${name}() takes no injectable database handle (${databaseName.source}); accept it as a parameter or option`),
      ),
  );
}

function takesDatabase(tree: ts.SourceFile, parameter: ts.ParameterDeclaration, databaseName: RegExp): boolean {
  const name = parameter.name;
  if (ts.isIdentifier(name) && databaseName.test(name.text)) return true;
  if (ts.isObjectBindingPattern(name)) {
    const hasBinding = name.elements.some((element) => databaseName.test((element.propertyName ?? element.name).getText(tree)));
    if (hasBinding) return true;
  }
  return parameter.type !== undefined && typeHasMember(tree, parameter.type, databaseName, 0);
}

function typeHasMember(tree: ts.SourceFile, type: ts.TypeNode, databaseName: RegExp, depth: number): boolean {
  if (depth > 3) return false;
  if (ts.isTypeLiteralNode(type)) return membersHave(tree, type.members, databaseName);
  if (ts.isIntersectionTypeNode(type)) return type.types.some((part) => typeHasMember(tree, part, databaseName, depth + 1));
  if (ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName)) {
    const referenced = type.typeName.text;
    return tree.statements.some((statement) => {
      if (ts.isInterfaceDeclaration(statement) && statement.name.text === referenced) {
        return membersHave(tree, statement.members, databaseName) || extendsHave(tree, statement, databaseName, depth);
      }
      return ts.isTypeAliasDeclaration(statement) && statement.name.text === referenced && typeHasMember(tree, statement.type, databaseName, depth + 1);
    });
  }
  return false;
}

function membersHave(tree: ts.SourceFile, members: ts.NodeArray<ts.TypeElement>, databaseName: RegExp): boolean {
  return members.some((member) => member.name !== undefined && databaseName.test(member.name.getText(tree)));
}

function extendsHave(tree: ts.SourceFile, declaration: ts.InterfaceDeclaration, databaseName: RegExp, depth: number): boolean {
  return (declaration.heritageClauses ?? []).some((clause) =>
    clause.types.some(
      (heritage) =>
        ts.isIdentifier(heritage.expression) &&
        typeHasMember(tree, ts.factory.createTypeReferenceNode(heritage.expression.text), databaseName, depth + 1),
    ),
  );
}
