# Inline Assembly

Inline assembly is a type, not a statement. `asm("template")` names the type, the operands are an ordinary aggregate initializer, and calling the value runs the assembly.

```biron
const add = asm("add %1, %0") {
	asm::RegRW { .ANY },      // operand 0, read then written
	asm::RegRD { .ANY },      // operand 1, read
	asm::Clobber { "cc" },
};

let sum = add(3 as! Sint32, 4 as! Sint32);   // 7
```

Assembly blocks are constants. They compose from other constants and pass through generics like any other constant value.

## The type

The template is the assembler text. Two blocks whose templates are spelled identically have the same type.

Assembly blocks are zero-sized. A block adds nothing to a struct or tuple containing it.

Assembly blocks are not addressable, unlike every other zero-sized type. `&block`, `*asm(...)`, and `&asm(...)` are rejected. A block is a compile-time operand description with no memory image.

Every value of an assembly type is constant, so bind one with `const`. The type may be inferred from the literal, annotated on the binding, or named first.

```biron
const add2: asm("add %1, %0") = {
	asm::RegRW { .ANY },
	asm::RegRD { .ANY },
};

type Add = asm("add %1, %0");
const add3 = Add {
	asm::RegRW { .ANY },
	asm::RegRD { .ANY },
};
```

## Calling

Arguments correspond to the reading operands in declaration order. The result is the writing operands in declaration order. One write returns a value directly and several return a tuple.

Memory operands take an argument but never appear in the result.

## Operands

Each element of the initializer is one operand. The type selects the kind and the direction together. `RD` reads, `WR` writes, `RW` does both.

| Type | Direction | Describes |
|------|-----------|-----------|
| `asm::RegRD` | read | a register the instruction reads |
| `asm::RegWR` | write | a register the instruction writes |
| `asm::RegRW` | read and write | one register read then written |
| `asm::MemRD` | read | memory read in place |
| `asm::MemWR` | write | memory written in place |
| `asm::MemRW` | read and write | memory read and written in place |
| `asm::Imm` | read | an immediate baked into the instruction |
| `asm::Clobber` | | a location the instruction destroys |

> [!NOTE]
> These types are defined in the `asm` module rather than by the compiler. Only their shape matters, and you can write equivalents yourself.

## Registers

The `reg` field names the register. `.ANY` lets the compiler choose. A specific name such as `.RAX` pins the operand to that register.

Only the architectural name is given. The access width follows from the value, so a `Uint32` bound to `.RAX` assembles as `eax`.

Two operands cannot pin the same register. Use a single `RegRW` instead.

## Write types

A write states its result type as an element and an extent. An extent of 1 gives the scalar element. Anything larger gives `[extent]element`.

```biron
asm::RegWR { .ANY, .F32, 4 }    // [4]Real32
asm::RegWR { .ANY, .U128, 1 }   // Uint128
asm::RegWR { .ANY, .F64, 1 }    // Real64
```

| Element | Lane |
|---------|------|
| `.S8` `.S16` `.S32` `.S64` `.S128` | signed integer |
| `.U8` `.U16` `.U32` `.U64` `.U128` | unsigned integer |
| `.F16` `.F32` `.F64` | float |

These name the built-in `Sint32`, `Uint32`, `Real32`, and the rest. An enumerator cannot share a name with a built-in type, hence the short spelling.

`.Auto` on a write is an error. A pure write provides no input to infer a type from.

Reads take no element. Their type comes from the argument.

The element and extent describe a value, not a register file. The backend picks the register class for the target. A `[4]Real32` write occupies an xmm on x86-64, and another architecture is free to answer differently.

## Read-write operands

`RegRW` with `element = .Auto` returns the input type. This is the default and covers read-modify-write.

```biron
const inc = asm("add $1, %0") { asm::RegRW { .ANY } };

let n = inc(41 as! Sint32);   // Sint32 in, Sint32 out
```

A real element converts in place. The operand still occupies one register.

```biron
// [4]Sint32 in, [4]Real32 out
const cvt = asm("cvtdq2ps %0, %0") { asm::RegRW { .ANY, .F32, 4 } };
```

Both sides of a `RegRW` must use the same register class. Cross-class conversion needs two registers, written as a separate `RegWR` and `RegRD`.

```biron
const cpuid = asm("cpuid") {
	asm::RegRW { .RAX },          // leaf in, eax out
	asm::RegWR { .RBX, .U32, 1 }, // ebx out
	asm::RegRW { .RCX },          // subleaf in, ecx out
	asm::RegWR { .RDX, .U32, 1 }, // edx out
};

let r = cpuid(leaf, 0);   // r.0, r.1, r.2, r.3
```

## Early clobber

`early = true` forces the output into a register distinct from every input. Use it when the instruction writes its output before reading all of its inputs.

```biron
asm::RegWR { reg = .ANY, element = .U64, extent = 1, early = true },
```

## Memory operands

Memory operands take a pointer argument and access that memory in place. They never appear in the result, so you observe the change through the same pointer. The access type comes from the pointee and no element is written.

```biron
const fetch_add = asm("lock xadd %0, %1") {
	asm::RegRW { .ANY },   // addend in, old value out
	asm::MemRW { },        // updated in place
	asm::Clobber { "cc" },
};

let old = fetch_add(delta, &counter);   // counter now contains the sum
```

## Immediates

`Imm` takes a compile-time constant. There is no write form.

```biron
asm::Imm { 42 as! Uint32 },
```

## Clobbers

Each `Clobber` names one location the instruction destroys that is not an operand. Write a register name, `"memory"`, or `"cc"`.

> [!CAUTION]
> Undeclared clobbers cause miscompilation. The compiler assumes anything unlisted survives the call.

An empty template with only a `"memory"` clobber is a compiler memory barrier. It emits nothing and prevents loads and stores from moving across it.

```biron
asm("") { asm::Clobber { "memory" } }();
```

## Template syntax

`%N` refers to operand N, counting non-clobber entries from zero. Referring past the last operand is an error.

Every `.ANY` register requires a `%N`. The compiler chooses that register late, so there is no name to write in the template. Pinned registers are named directly and take no placeholder.

An operand appears in the template only if the instruction mentions it. `syscall` takes no operand text, yet its register operands are still declared to place the values.

## Generics

Assembly types are generic arguments like any other type.

```biron
type Cell = struct[T: Type] { header: Sint32, payload: T }

const CELL = Cell::[asm("add $1, %0")] {
	header  = 0,
	payload = asm("add $1, %0") { asm::RegRW { .ANY } }
};

let n = CELL.payload(41 as! Sint32);   // 42
```

## Naked functions

An assembly type in body position defines a naked function. No prologue or epilogue is emitted and the template is the entire body.

```biron
fn add(Sint32, Sint32) -> Sint32 asm("mov %edi, %eax\n\tadd %esi, %eax\n\tret");

fn five() -> Sint32 asm("
	mov $5, %eax
	ret
");
```

Parameters are unnamed types. They remain the ABI contract and fix the register each argument arrives in, but no name is referenceable from the template.

The return type is load-bearing. `-> T` requires the result in the ABI return register. `-> !` marks a function that never returns.

Naked functions take no operand list, cannot have a receiver, and cannot be generic. They are ordinary functions otherwise, taking attributes and serving as associated functions.

## Safety

Building an assembly value is safe. Calling one can violate memory and type safety. Nothing gates a call today, though `unsafe` is intended to once that keyword exists.
