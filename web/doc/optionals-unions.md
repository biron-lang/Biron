# Optionals & Unions

Biron provides two ways to hold "a value that might not be there" or "a value that is one of several types", the optional `?T` and the tagged `union`. Both are inspected the same way, by *control flow* rather than by an unwrap operator. When a branch condition proves a value is present (or is a particular variant), the compiler narrows the variable to that refined type for the length of the branch. This chapter covers both, side by side, including the ternary forms.

## Optionals

An optional is written `?T` for any type `T`. It holds either a present `T` or nothing. A value of the base type coerces straight into the optional as a present value, and an empty optional is written `{}`, called the *none* case.

```biron
let x: ?Sint32 = 5;    // present, holds 5
let y: ?Sint32 = {};   // none, holds nothing
```

An optional assigns to another optional of the same type, copying it. Optionals also work as constants and as function parameters, so "maybe a value" can be passed around directly.

```biron
const MAYBE: ?Sint32 = 42;
const NOPE:  ?Sint32 = {};

fn opt_or(o: ?Sint32, d: Sint32) -> Sint32 {
	if o { return o; }
	return d;
}
```

> [!NOTE]
> `?*T` and `?&T` (optional pointer, optional reference) use a null pointer as the none case, so they cost nothing extra over the bare pointer. Any type can be made optional, including function values such as `?fn(x: Sint32) -> Sint32`.

### Narrowing by control flow

There is no `.unwrap()` and no postfix operator to look inside an optional. Instead, using the optional as an `if` condition is the presence test, and inside the then branch the same name is narrowed to the contained value.

```biron
fn opt_or(o: ?Sint32, d: Sint32) -> Sint32 {
	if o {
		return o;   // here `o` is a plain Sint32
	}
	return d;
}
```

> [!IMPORTANT]
> Only a bare identifier condition narrows. A condition that is neither a `Bool` nor an optional is an error, so something that has no presence cannot be accidentally tested.

### Narrowing binds by reference

The narrowed name is a reference into the original storage, not a copy. That makes it an lvalue. Assigning to it inside the branch writes the value back, leaving the optional present. A later test observes the new value.

```biron
fn bump(o: ?Sint32) -> Sint32 {
	if o {
		o = o + 1;   // writes back into the optional, still present
		return o;
	}
	return 0;
}
```

## Unions

A `union` is a value that is exactly one of a fixed set of types at a time, with a tag that says which one. One is declared with the `type` keyword.

```biron
type Variant = union { String, Bool, Sint32, Real32 }
```

A union is constructed simply by assigning one of its variants. That sets the tag and stores the value.

```biron
let s: Variant = "hello";
let b: Variant = true;
let i: Variant = 42;
let f: Variant = 3.5 as Real32;
```

> [!NOTE]
> The storage is sized and aligned to the largest variant, so a 16-byte `String` and a 4-byte `Real32` live in the same slot at different times.

### Testing and narrowing with `is`

`x is T` is a runtime test of the tag. It asks "is `x` currently the `T` variant?" and yields a `Bool`. As an `if` condition it narrows `x` to that variant inside the branch, exactly like an optional.

```biron
fn kind(x: Variant) -> Sint32 {
	if x is String  { return 0; }
	if x is Bool    { return 1; }
	if x is Sint32  { return 2; }
	if x is Real32 { return 3; }
	return -1;
}
```

Inside `if x is Real32 { ... }`, `x` is a `Real32` and can be used as one.

```biron
fn dbl_float(x: Variant) -> Sint32 {
	if x is Real32 { return (x * (2.0 as Real32)) as Sint32; }
	return -1;
}
```

Just like an optional, the narrowed union binding is an lvalue. Assigning to it writes the new value back in place. Because the narrowed type is the variant, only that variant can be written, so the tag stays valid.

```biron
let m: Variant = 1;
if m is Sint32 { m = 100; }   // updates the payload in place, tag unchanged
```

## Narrowing in the ternary

The ternary `cond ? a : b` validates its condition exactly like an `if`, so the same narrowing applies to the true branch. An optional narrows in the `?` arm, and a union `is` test narrows there too.

```biron
// optional: `q` is the unwrapped Sint32 in the `?` arm
fn safe_div(a: Sint32, b: Sint32) -> Sint32 {
	let q = a / b;      // checked division yields ?Sint32
	return q ? q : -1;
}

// union: `x` is a Sint32 in the `?` arm
fn get_int(x: Variant) -> Sint32 {
	return x is Sint32 ? x : -1;
}
```

The two arms must share a type. A `{}` arm takes the other arm's type. Otherwise the arm types must match. Only the taken arm is evaluated, so the ternary behaves like a compact `if`/`else` that produces a value.

The parallel is the whole point. Whether a value is an optional or a union, it is never accessed blindly. A condition proves the case, and the compiler provides the refined value for that branch.

| Form | Presence / variant test | Narrows to |
|------|-------------------------|------------|
| `?T` optional | `if x { ... }` | the contained `T` |
| `union` | `if x is T { ... }` | the variant `T` |
| ternary | `x ? ... : ...` / `x is T ? ... : ...` | as above, in the `?` arm |
