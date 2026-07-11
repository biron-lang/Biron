# Properties

A *property* is a compile-time fact about a type or an expression. Properties are obtained with the `of` operator, written `name of X`, where `name` selects the property and `X` is either a type or an expression. The result is a constant expression or a type, so it is fixed at compile time.

## The `of` operator

`of` is written between a property name and its operand, as `name of X`. The operand `X` may be a type, such as `Sint32`, or an expression such as a variable, in which case the property is taken from the expression's type. Both spellings give the same answer, so `size of p` and `size of Sint64` agree when `p` is a `Sint64`.

Because every property is a compile-time value or a type, an `of` result may stand wherever a constant or a type annotation is expected, including an array length, a `const` binding, or a parameter type. `of` sits at precedence level 8, alongside `as` and `is`. See **Expressions** for the full table.

## Built-in properties

Four properties are built in and apply to any operand for which they make sense.

| Written | Operand | Result |
| --- | --- | --- |
| `size of X` | any type or value | the size in bytes, a `Length` |
| `align of X` | any type or value | the alignment in bytes, a `Length` |
| `count of X` | an array or tuple | the number of elements, a `Length` |
| `type of X` | an expression | the type of that expression |

```biron
let n = size of Sint32;           // 4
let a = align of Sint64;          // 8
let k = count of [3]Sint32;       // 3
let t = count of (1, "x", true);  // 3

let y: Sint16 = 10;
let z: type of y = 20;            // z is a Sint16, taken from y
```

`size` and `align` accept any type or any value, and a value is measured through its type. `count` is limited to arrays and tuples, the only types with a fixed element total. `type` accepts an expression and yields its type, which is what lets `type of y` serve as an annotation.

## User-defined properties

A struct extends this set with properties of its own. A top-level `const` or `type` declaration written inside the struct body becomes a property of that struct. A `const` member is a constant property and a `type` member is a type property, and both are taken through `of` exactly like the built-ins, from the struct type or from any value of it.

```biron
type Rgba = struct {
	r: Uint8,
	g: Uint8,
	b: Uint8,
	a: Uint8,

	const channels = 4;
	type component = Uint8;
}

let c = channels of Rgba;                 // 4, a constant
let px = Rgba { .r = 255, .g = 0, .b = 0, .a = 255 };
let d = channels of px;                   // 4, taken from a value too

let one: component of Rgba = 255;         // component is Uint8
```

A field and a member property are distinct. A field holds data that differs per value, while a `const` or `type` member belongs to the struct itself and is never stored in an instance.

> [!IMPORTANT]
> Only the built-in properties and the members a struct declares are valid on the left of `of`.
