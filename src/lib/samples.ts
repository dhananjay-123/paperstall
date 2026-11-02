// Built-in samples are rendered paper props in /public/samples (`python scripts/make-samples.py public/samples`;
// swap in real photos any time). A sample is shown only
// when its photo exists. `<id>.read.json` (optional) is a cached result from a real earlier
// run, offered only when the live Read is rate-limited, and always labelled "cached".

export type Sample = { id: string; title: string; hint: string; image: string; cached: string };

export const SAMPLES: Sample[] = [
  { id: "coffee-cart", title: "Coffee cart chalkboard", hint: "A list of drinks and pastries → storefront", image: "/samples/coffee-cart.jpg", cached: "/samples/coffee-cart.read.json" },
  { id: "freelancer-bill", title: "Freelancer's bill", hint: "A handwritten bill with a total → invoice", image: "/samples/freelancer-bill.jpg", cached: "/samples/freelancer-bill.read.json" },
  { id: "piano-lessons", title: "Piano lessons notice", hint: "$120/month → subscription", image: "/samples/piano-lessons.jpg", cached: "/samples/piano-lessons.read.json" },
  { id: "phone-accessories", title: "Phone accessories stall", hint: "Branded items → market check", image: "/samples/phone-accessories.jpg", cached: "/samples/phone-accessories.read.json" },
  { id: "taco-stand", title: "Spanish taco stand menu", hint: "Another language → English storefront", image: "/samples/taco-stand.jpg", cached: "/samples/taco-stand.read.json" },
];
