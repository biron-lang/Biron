# The Compiler

The Biron compiler is a single command that turns source into a program. This chapter covers how a program is built, what the compiler can emit, how fast it is, the guarantees it makes about its output, and how the compiler itself is put together.

## Building a program

One command compiles and links a whole program.

```
biron hello.biron -o hello
```

The compiler reads the source, checks it, compiles it, links it, and writes a runnable `hello`. A program spread across several modules is built the same way, with the compiler following the import graph from the entry file.

## Native executables or portable C

By default the compiler produces a native executable. It can instead emit **portable C** that any ordinary C compiler can build. Both outputs pass through the same optimized, low-level intermediate representation, so the native binary and the generated C describe the same program.

> [!NOTE]
> The C output is useful for bootstrapping onto a platform that has a C toolchain but no native backend of its own.

## Speed

The compiler is **fully pipelined**. Parsing, type checking, and code generation overlap as a single streaming pass ordered by the import graph, with no phase barriers between them, so the work spreads across cores. On a 16-thread Zen 5 it parses at around 6 million lines per second and produces fully optimized binaries end to end at around 2 million lines per second.

## Reproducible builds

Every build is **byte-for-byte reproducible**. The same source compiled again, with the same compiler, produces identical output every time, with nothing left to timestamps, memory addresses, or iteration order.

> [!RATIONALE]
> Reproducible output makes a binary verifiable and makes a build cache dependable.

## A hermetic compiler

The compiler is built the way Biron code is built, with every effect threaded through by hand. It is written in C++, which has no effect system of its own, so an effect is passed as an explicit function argument rather than declared in a signature. The discipline is the same. The outside world is never accessed through a global or an ambient handle.

Because of this the compiler is itself **hermetic**. It has no hidden global state, so it can be embedded inside another program and used directly, with its effect implementations supplied by the host. It is therefore a safe foundation for tools built on top of it, such as a language server, a formatter, or an editor integration, and several instances can run at once without interfering.
