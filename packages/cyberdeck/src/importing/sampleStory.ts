/** Offered to new projects to try the import: a short scene with dialogue, staging, a choice and its branches. */
export const SAMPLE_STORY = `[import: chapter]
# Chapter 1 — The Letter
[bg: classroom_evening] [music: calm]
The classroom was empty. The last rays of the sun slid across the desks, and the dust floated in the light as if it had nowhere else to be. Somewhere in the building, a door closed.
[enter: marie]
— Marie: You came after all.
— Theo: I said I would.
— Marie: I read your letter again last night. [marie: surprised] Then I found the second one, hidden under the first. [wait: 0.6] [marie: worried] Why didn't you tell me?
[choice: Answer]
> Tell her the truth. = Truth
> Change the subject. = Dodge
[if: Answer is Truth]
— Theo: Because I was afraid you would laugh.
[marie: smile]
— Marie: I would never laugh at you.
[else]
— Theo: Did you see the sunset? It's beautiful tonight.
[marie: annoyed]
— Marie: Don't do that.
[end]
[transition: fade] [bg: rooftop]
The wind on the rooftop was cold, and the city below had started to light up, one window at a time.
[enter: jules slide-from-right 0.8s wait]
— Jules: So this is where you two were hiding.
[marie: surprised]
— Marie: Jules?!
[exit: jules slide-to-right] [move: marie center]
— Marie: He never could stand the cold.
[exit: marie fade 1.5s] [music: stop]
To be continued.
`
