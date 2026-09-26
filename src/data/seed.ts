import type { ExhibitContent, MuseumState } from "../domain/model";

const collection: (ExhibitContent & { id: string })[] = [
  {
    id: "rain-library",
    title: "The Rain Library",
    subtitle: "An umbrella that keeps the weather you walked through.",
    category: "Little rituals",
    year: "Imagined, 2041",
    artifact: "umbrella",
    color: "#ea643d",
    premise:
      "Every canopy carries a small acoustic pocket. Open it on a clear day and the rain from your last walk falls again, in sound alone. A city begins lending its weather: a drizzle from a first date, a storm from a long way home.",
    almost:
      "The prototype could remember the rain. Nobody could agree who owned a rainy afternoon.",
    question: "Who should be allowed to borrow your rain?",
    branches: [
      {
        id: "share-weather",
        label: "Give it to the neighborhood",
        consequence:
          "Weather becomes a shared collection. The city needs somewhere to sit and listen together.",
        targetId: "listening-bench",
      },
      {
        id: "keep-weather",
        label: "Keep one afternoon for yourself",
        consequence:
          "Private weather becomes a daily ritual. A minute starts to feel larger than its measurement.",
        targetId: "borrowed-minute",
      },
    ],
  },
  {
    id: "borrowed-minute",
    title: "The Borrowed Minute",
    subtitle: "A clock that asks for less of your day.",
    category: "Slower living",
    year: "Imagined, 2038",
    artifact: "clock",
    color: "#aca6df",
    premise:
      "At a time you never choose, the hands stop for sixty seconds. Nothing else in the world slows down. The clock simply declines to count. Its makers call this tiny gap a room inside the day.",
    almost:
      "Testers loved the pause, then began scheduling around it. A gift had become another appointment.",
    question: "What would you put in an uncounted minute?",
    branches: [
      {
        id: "minute-rest",
        label: "Leave it beautifully empty",
        consequence:
          "The pause asks for a softer light: one that knows when enough has been done.",
        targetId: "permission-lamp",
      },
      {
        id: "minute-share",
        label: "Send it to someone far away",
        consequence:
          "A minute becomes a message with no words. A very quiet kind of radio is invented.",
        targetId: "quiet-radio",
      },
    ],
  },
  {
    id: "listening-bench",
    title: "The Listening Bench",
    subtitle: "Street furniture with room for an unfinished thought.",
    category: "Shared spaces",
    year: "Imagined, 2044",
    artifact: "bench",
    color: "#c4c977",
    premise:
      "Two seats face slightly away from each other. Between them, a brass dish catches the sound of the street and makes it softer. People can share a silence without having to introduce themselves.",
    almost:
      "The first installation was mistaken for a broken bench. The second was too popular to stay quiet.",
    question: "How much company does a silence need?",
    branches: [
      {
        id: "bench-distant",
        label: "Let another city listen in",
        consequence:
          "Two distant benches exchange the sound of an empty seat. The connection needs no conversation.",
        targetId: "quiet-radio",
      },
      {
        id: "bench-grow",
        label: "Make room for something growing",
        consequence:
          "One seat becomes a planter. A public space begins to measure care instead of footfall.",
        targetId: "tomorrow-garden",
      },
    ],
  },
  {
    id: "permission-lamp",
    title: "The Permission Lamp",
    subtitle: "A light that has nothing left to ask of you.",
    category: "Little rituals",
    year: "Imagined, 2036",
    artifact: "lamp",
    color: "#f0bd60",
    premise:
      "Turn the shade toward your desk and it lights your work. Turn it toward the wall and it paints a warm circle with no useful purpose. There is no timer, no score, and no app to congratulate you for resting.",
    almost:
      "The marketing team asked for a productivity dashboard. The designer took the prototype home.",
    question: "Where should this useless light go next?",
    branches: [
      {
        id: "light-garden",
        label: "Outside, to keep a seed company",
        consequence:
          "A circle of light becomes a patch of patience. Nothing has to bloom by a deadline.",
        targetId: "tomorrow-garden",
      },
    ],
  },
  {
    id: "quiet-radio",
    title: "The Quiet Radio",
    subtitle: "A broadcast of someone simply being there.",
    category: "Shared spaces",
    year: "Imagined, 2047",
    artifact: "radio",
    color: "#79bcb3",
    premise:
      "A pair of radios can send one sound: a soft, hand-made click. A person turns the dial in one home; a little wooden reed moves in another. No recording, no notification count. Just a signal that crossed a distance.",
    almost:
      "Investors could not find a way to make the signal more engaging. That was the point.",
    question: "What might a small signal begin?",
    branches: [
      {
        id: "radio-garden",
        label: "A promise to care for something",
        consequence:
          "Two homes start tending the same imagined garden. Its only harvest is another reason to check in.",
        targetId: "tomorrow-garden",
      },
    ],
  },
  {
    id: "tomorrow-garden",
    title: "The Tomorrow Garden",
    subtitle: "A garden planted for a person you may never meet.",
    category: "Slower living",
    year: "Imagined, 2050",
    artifact: "garden",
    color: "#a8b894",
    premise:
      "The packet has no picture of the flower, only a small instruction: plant this where somebody waits. The seeds are ordinary. The invention is a network of people making a place gentler for a future stranger.",
    almost:
      "It worked. Then everyone disagreed about whether something this ordinary counted as an invention.",
    question: "Perhaps the almost was enough.",
    branches: [],
  },
];

export function createSeed(): MuseumState {
  return {
    schemaVersion: 1,
    version: 1,
    audit: [],
    exhibits: collection.map(({ id, ...content }, index) => ({
      id,
      number: String(index + 1).padStart(2, "0"),
      draft: { revision: 1, content: structuredClone(content) },
      published: { revision: 1, content: structuredClone(content) },
      review: null,
      approval: null,
    })),
  };
}
