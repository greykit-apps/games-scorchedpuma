/* Scorched Puma -- the talking tanks. In 1.5 tanks taunted when they fired
 * and said last words when they died; here the crews are pumas and wolves,
 * and what they say about each other is not kind. Every line is our own.
 * Settings has how often (Off, Sometimes, Often, Always). */
(() => {
  const SP = globalThis.SP;

  const LINES = {
    /* a puma firing at a wolf */
    pw: [
      "Sit. Stay. Explode.", "Fetch THIS, mutt.", "Who's a good boy? Not you. Never you.",
      "Smells like wet dog. Let me fix that.", "Back to the pound with you!", "Go sniff another wolf's butt.",
      "You drink out of toilets. I'm doing you a favor.", "Here's a bone. It's a nuke.",
      "Roll over. Play dead. Actually, just the second one.", "Bad dog! BAD!",
      "Your ancestors had dignity. You have fleas.", "Howl at THIS moon.", "Chase your tail, flea bag.",
      "Even your fleas are embarrassed.", "A pack of idiots is still idiots.", "Nice collar. Who's your owner?",
      "Cone of shame? Try crater of shame.", "Lick yourself on your own time.",
      "Twenty thousand years of evolution, and you beg for kibble.", "Your breath could strip paint. So can this.",
      "The mailman sends his regards.", "Cats rule, dogs drool. Look at you, drooling.",
      "I've coughed up hairballs scarier than you.", "Go hump a leg somewhere else.",
      "Pack mentality: one brain, ten mouths.", "You chase cars. I'm a tank. Do the math.",
      "Spay and neuter your wolves, people.", "Bark all you want. I'm not listening.",
      "Tail between your legs already?", "Heel.", "Shake! Good. Now shake apart.",
      "A chihuahua would be ashamed of you.", "Want a treat? It's high explosive.",
      "Off to the vet. The kind with the needle.", "Your howl sounds like a dying accordion.",
      "Pee on this tree? I removed the tree.", "Wag THIS.", "Rabies is not a personality.",
      "Domesticated. Pathetic.", "Bet you can't catch this one either.",
    ],
    /* a wolf firing at a puma */
    wp: [
      "Here, kitty kitty kitty...", "Nap time's over, furball.", "Cough THIS up.",
      "Go knock something off a table.", "Laser pointer? No. Actual laser.", "Nine lives. Let's start counting.",
      "Curiosity killed the cat. So will this.", "Scared of a cucumber, tough guy?", "Bath time!",
      "Who's a big scary kitty? Nobody.", "Your litter box called. It's full.",
      "Lands on its feet? Not from up there.", "Sleeps 18 hours a day and STILL looks tired.",
      "Nobody wants your dead bird.", "Put down the catnip and fight.", "Hiss all you like, Mittens.",
      "Big cat, small brain.", "Fits in a box. Will fit in a crater.", "Shed on THIS.",
      "Your purr is just a sad little engine.", "A cat in a tank. Who let you out?", "Ball of yarn incoming.",
      "Puma? More like puny-ma.", "Somebody spray this one with water.",
      "Your tongue is sandpaper and so is your aim.", "You lick your own butt and call it a bath.",
      "Go chase a red dot, Garfield.", "The crazy cat lady can pick up the pieces.", "Meow THIS.",
      "I don't need a pack to take out a house cat.", "Declaw this kitty.", "Should've stayed under the bed.",
      "Your fur's on everything. Including my turret.", "Fancy Feast? You're about to BE one.",
      "Off the counter, cat!", "Toilet paper shredder, meet tank shredder.", "Eight lives left. Then seven.",
      "Your cardboard box won't save you.", "Hairball in three... two...",
      "Cats: the only animal that pays rent in dead mice.",
    ],
    /* puma on puma */
    pp: [
      "Nothing personal, cousin. Okay, a little personal.", "Two cats, one sunbeam. You know how this ends.",
      "My territory. I sprayed it and everything.", "Sorry, sibling. You were in my spot.",
      "Stop grooming and start dodging.", "Only room for one top cat.", "You were adopted. From a dumpster.",
      "Back off. My litter box.", "I've seen better pounces from a throw pillow.", "Paw slipped. Totally an accident.",
      "Your purr annoys me.", "Mama always liked me better.", "This is for eating out of my bowl.", "Cat fight!",
      "Hiss at my own kind? Watch me.",
    ],
    /* wolf on wolf */
    ww: [
      "Alpha coming through.", "Pack's getting a little smaller.", "Sorry, brother. You smell weird.",
      "I'm the alpha now.", "You're the runt and everybody knows it.", "Nothing personal. Survival of the fittest.",
      "Stop sniffing me.", "Pack meeting's canceled. Permanently.", "You ate my kibble. You die.", "Beta behavior.",
      "Lone wolf mode: activated.", "I saw you begging at the table. Disgraceful.", "Bad pack member!",
      "Howl at the moon on your own time.", "Who let THIS dog out?",
    ],
    /* last words */
    pd: [
      "Eight lives left... right? RIGHT?", "Tell my litter box I loved it.", "I regret nothing. Except that.",
      "Avenge me... after a nap.", "Should've stayed in the cardboard box.", "Curiosity... was a mistake.",
      "My sunbeam... it's fading...", "I meant to land on my feet.", "Someone feed my kittens.",
      "Not the face! Not the beautiful face!", "I knocked over my last vase.", "Bury me with my catnip.",
      "That's one life. Eight to go.", "I'm not dead. I'm napping. Forever.", "Purr... purrrr... prrrt.",
      "Cats always land... on... ow.", "Tell the wolves they still smell.", "I blame the dog.",
      "This is so beneath me.", "Meeeooowwwwww...", "Dibs on the next life.", "Who moved my food bowl?",
      "I was the top cat. Briefly.", "Death? I'll ignore it like everything else.", "Pet me one last time...",
    ],
    wd: [
      "Awooooo... ooo... o.", "Tell the moon... goodbye.", "Was I... a good boy?", "I see a light. Is that a frisbee?",
      "Bury me with my favorite bone.", "Pack... remember... me...", "Dog heaven, here I come.",
      "Should've stayed on the porch.", "Who's gonna chase the mailman now?", "My tail... it's not wagging.",
      "At least I'm not a cat.", "Neutered by artillery.", "Tell my fleas they're free.",
      "Off to the big kennel in the sky.", "Not... the vet...!", "I smell... burning... me.",
      "Somebody fetch my soul.", "I chewed my last shoe.", "Avenge me, pack!", "It's raining... dogs.",
      "The alpha... is down.", "Belly rubs... at last...", "Even my howl's gone quiet.",
      "This is a ruff way to go.", "Bad dog. Dead dog.",
    ],
  };
  const ODDS = { off: 0, sometimes: 0.35, often: 0.7, always: 1 };
  const recent = [];

  const pick = list => {
    for (let i = 0; i < 8; i++) {
      const l = list[Math.floor(Math.random() * list.length)];
      if (!recent.includes(l)) { recent.push(l); if (recent.length > 20) recent.shift(); return l; }
    }
    return list[0];
  };

  SP.Talk = {
    LINES,
    /* a line for a shot, or null: the speaker's faction, the target's */
    attack(freq, speaker, target) {
      if (Math.random() >= (ODDS[freq] ?? 0.35)) return null;
      const k = speaker.faction[0] + (target ? target.faction[0] : speaker.faction === "puma" ? "w" : "p");
      return pick(LINES[k]);
    },
    /* last words come a little more often than taunts */
    death(freq, tank) {
      if (Math.random() >= Math.min(1, (ODDS[freq] ?? 0.35) * 1.6)) return null;
      return pick(LINES[tank.faction[0] + "d"]);
    },
  };
})();
