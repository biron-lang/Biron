# Inline Assembly

Inline assembly is offered as a statement in most languages. Biron offers it as a type instead, and a few unusual properties follow from that choice. Inputs, outputs, and clobbers of a block are supplied as an aggregate initializer for any variable declared of the asm type. Blocks are built from constant expressions and pass through generics as any constant value does, giving inline assembly the same templating the rest of the language already offers, in a cohesive and familiar syntax. Type checking over the operands becomes possible and rules out common mistakes, and the whole construct looks and behaves consistently in both its syntax and its semantics.

## The assembly type

`asm("template")` is a type whose template is the assembler text, and a value of the type is built by an ordinary aggregate initializer whose elements are the operands. Values of the type are constants, bound with `const`, and they compose from other constants and pass through generics as any constant does.

Because the asm type is [zero-sized](#types), a block placed as a field of a struct or an element of a tuple has no storage and adds nothing to the size around it. Two textually identical templates are the same type, and a block used as a struct field matches a block written at another spot with the same text. Unlike the other zero-sized types it has no address and must be a constant, and `&` on a block, together with a pointer or reference to the asm type, are rejected. Blocks exist only to be built and called.

As an example, an integer add of two registers is written as three operands. Here the block is an inline literal, and its type is inferred the way any `T { ... }` literal is.

```biron
const add = asm("add %1, %0") {
	asm::RegRW { .ANY },      // operand 0, read and write
	asm::RegRD { .ANY },      // operand 1, read
	asm::Clobber { "cc" },
};
```

Since it is a type like any other, it can also be written as an explicit type on the named binding, or through a named type too.

```biron
const add2: asm("add %1, %0") = {
	asm::RegRW { .ANY },
	asm::RegRD { .ANY },
	asm::Clobber { "cc" }
};

type Add = asm("add %1, %0");
const add3 = Add {
	asm::RegRW { .ANY },
	asm::RegRD { .ANY },
	asm::Clobber { "cc" }
};
```

## Running a block

Calling a value of the asm type executes it. Building the value is safe, because it is only constant data, and a call is the unsafe part, permitted only inside an `unsafe` block. Calling returns the block's outputs.

```biron
let sum = unsafe { add(x, y) };
```

Arguments are matched to the input operands by position, making `x` the first input and `y` the second. One output is returned as a plain value, and several as a tuple read with `.0` and `.1`.

## Operands

Each element of the aggregate is one operand, described by a value from the `asm` module. Direction is encoded in the operand type. `RD` reads an input, `WR` writes an output, and `RW` reads and then writes an in out. Register and memory operands come in all three directions, an immediate is always a read, and a clobber has no direction.

> [!NOTE]
> These types are a convenience which structurally matches the requirement for an `asm` type. There is nothing special about them and they are not a special "compiler builtin".

| Type | Direction | Used for |
|------|-----------|----------|
| `asm::RegRD` | read | a register input |
| `asm::RegWR` | write | a register output |
| `asm::RegRW` | read and write | a register in out |
| `asm::MemRD` | read | memory read in place |
| `asm::MemWR` | write | memory written in place |
| `asm::MemRW` | read and write | memory read and written |
| `asm::Imm` | read | an immediate input |
| `asm::Clobber` | | a destroyed location |

Register operands are given a `Reg` name, `.ANY` to leave the choice to the compiler, or a specific name such as `.RAX` to pin it. Register writes also state their output type, described below.

Each operand is referred to inside the template by its position. Positions are `%0` for the first, `%1` for the second, and so on. Operands appear in the template only when the instruction uses them. For example, the `add` instruction uses two, while `syscall` uses none, because a system call is passed its arguments in fixed registers.

## Typing an output

Registers can be wider than the value in them. One 128 bit vector register may contain a single 32 bit float, four packed 32 bit floats, or a 128 bit integer mask, and the instruction alone decides which. Inputs read their type from the value passed at the call, and their class and width are already known. Outputs have no value to read a type from, and a register write describes its type directly, by an element and an extent.

Together, `element` gives the type of one lane and `extent` gives the number of lanes. They denote an ordinary Biron type, the scalar element when the extent is one, and the array `[extent]element` when the extent is more than one. Values out of the register are then described in exactly the terms the rest of the language uses.

Elements are written with a letter for the class and a number for the bit width.

| Element | Lane |
|---------|------|
| `.S8` `.S16` `.S32` `.S64` `.S128` | signed integer |
| `.U8` `.U16` `.U32` `.U64` `.U128` | unsigned integer |
| `.F16` `.F32` `.F64` | float |

These correspond to the built in `Sint32`, `Uint32`, `Real32`, and the rest. Letters are used because an enumerator cannot share a name with a built in type.

```biron
asm::RegWR { .ANY, .F32, 4 }   // the output is a [4]Real32
asm::RegWR { .ANY, .U128, 1 }  // the output is a Uint128
asm::RegWR { .ANY, .F64, 1 }   // the output is a Real64
```

Element and extent describe the value, and the compiler chooses which register contains it on the target being built, making a `[4]Real32` output describe the same value everywhere, while the choice of a vector register on one architecture or a floating point register on another is made below the language. Immediates and memory operands describe no element, an immediate reading its type from the constant given and a memory operand from the pointer passed at the call.

> [!NOTE]
> Every register write must state a real element. Writes left without one have nothing to describe their result and are rejected.

## Inputs, outputs, and in-out

Direction decides how a register operand is seen at the call. Reads are passed in, writes are returned in the result, and a read write is both. Call arguments are the reads and read writes together with the memory pointers, and the result is the writes and read writes.

For example, CPUID reads four result registers from a leaf and a subleaf.

```biron
const cpuid = asm("cpuid") {
	asm::RegRW { .RAX },          // leaf in, result out
	asm::RegWR { .RBX, .U32, 1 }, // result out
	asm::RegRW { .RCX },          // subleaf in, result out
	asm::RegWR { .RDX, .U32, 1 }, // result out
};
let r = unsafe { cpuid(leaf, 0) };   // r.0, r.1, r.2, r.3
```

Read writes read their input type from the value and, by default, write the same type back, the ordinary read and modify. When only a register is given, the output keeps the input type, and `asm::RegRW { .ANY }` returns whatever type went in. When the output type differs from the input, as in a conversion in place, the element and extent state the new output type.

```biron
// four packed integers in, four packed floats out of one register
const cvt = asm("cvtdq2ps %0, %0") { asm::RegRW { .ANY, .F32, 4 } };
```

Because an in out uses one register, its input and its output must use the same kind of register. Converting between two kinds, such as a general integer to a floating point register, is genuinely two registers, written as a separate write and read rather than one read write.

## Memory operands

Memory operands are passed a pointer, and the instruction reads or writes that memory in place. Memory operands are never part of the result, and a change is observed through the same pointer afterward. Their type comes from the pointer, and no element is described.

For example, an atomic fetch and add returns the old value and leaves the sum in memory.

```biron
const fetch_add = asm("lock xadd %0, %1") {
	asm::RegRW { .ANY },   // added in, old value out
	asm::MemRW { },        // updated in place
	asm::Clobber { "cc" },
};
let old = unsafe { fetch_add(delta, &counter) };   // old value returned, counter has the sum
```

## Immediate values

Immediate operands are a constant known at compile time. It is always a read, and there is no write form of one.

```biron
asm::Imm { 42 as! Uint32 },
```

## Clobbers

Clobbers record one location the instruction destroys that is not an operand. Each is its own entry, a register name such as `"rcx"`, or `"memory"` for memory the instruction touches, or `"cc"` for the condition flags.

> [!CAUTION]
> Anything left undeclared may be miscompiled, so every destroyed register and flag must be listed as a clobber.

Given an empty template and only a `"memory"` clobber, a block is a compiler memory barrier. It emits no instruction, and it orders the surrounding loads and stores so that none are moved across it.

```biron
unsafe { asm("") { asm::Clobber { "memory" } }(); }
```

> [!NOTE]
> Since an asm value is a type like any other, it can also be invoked immediately, as in the example above.

## Composition

Because a block is a value of an ordinary type, it composes the way other values do. Operand lists are built from constant expressions and shared constants, and factoring out and reusing a common sequence is possible. Asm types are also a generic argument like any other, and one routine can be written over an unknown block and specialized for each one. This is the same templating the rest of the language already has.

## Type checking

Because the operands are typed and the template is checked against them, a class of common mistakes is caught before the program runs. Register writes must state an element, a missing operand is reported, and the type of each input register follows from its value rather than being repeated by hand.

Without a fixed name, an `.ANY` register is referred to only by a `%N` placeholder in the template. Each `.ANY` register must have a placeholder, and each placeholder must correspond to an operand, matching the number of `.ANY` registers to the number of placeholders. Pinned registers are referred to by their own name in the template instead, and need no placeholder.

## Examples

Both examples below on x86-64 use more of the operand model, together with the CPUID block above.

Below, a 128 bit compare and exchange uses `CMPXCHG16B`. Expected value occupies the rdx and rax pair and desired value the rcx and rbx pair, the address is in rsi, and the zero flag reports whether the exchange happened.

```biron
const cas16 = asm("lock cmpxchg16b (%rsi); setz %r8b") {
	asm::RegRW { .RAX },          // expected low in, old low out
	asm::RegRW { .RDX },          // expected high in, old high out
	asm::RegRD { .RBX },          // desired low
	asm::RegRD { .RCX },          // desired high
	asm::RegRD { .RSI },          // pointer to the 16 byte aligned value
	asm::RegWR { .R8, .U8, 1 },   // 1 on success, 0 on failure
	asm::Clobber { "memory" },
	asm::Clobber { "cc" },
};
let result = unsafe { cas16(exp_lo, exp_hi, new_lo, new_hi, addr) };
// result.0 = old_lo
// result.1 = old_hi
// result.2 = ok
```

## Naked functions

When an asm block is written in place of a function body, the function is naked. No entry or exit code is added, and the body is the whole function. Arguments arrive in the registers of the calling convention, and the return value is left in the register the convention expects, using those registers directly. Naked functions are written with no operand list.

```biron
fn foo(Args) -> Rets asm("
	// instructions
");
```

Parameters of a naked function are written as types alone, with no names, because a name could not be used inside the assembly. Its return type still matters. Value return types require the result in the return register, and the never type `!` marks a function that does not return.

Naked functions cannot have a receiver and cannot be generic. In every other respect it is an ordinary function. It can accept attributes and be an associated function. Calling one needs an `unsafe` block, the same as a call on an asm value.

## Safety

Building an asm value is safe, because it is only constant data. Running it can break the guarantees the rest of the language keeps, and a call on an asm value is permitted only inside an `unsafe` block.
