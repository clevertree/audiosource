class Instruction {
    constructor(instructionData = [0], index=null) {
        /** @deprecated **/
        this.index = index;
        this.data = instructionData;
    }

    get command() {
        return this.data[1];
    }

    set command(newCommand) {
        this.data[1] = newCommand;
    }


    get deltaDurationTicks() {
        return this.data[0];
    }

    set deltaDurationTicks(newDeltaDuration) {
        this.data[0] = newDeltaDuration;
    }

    getDurationString(timeDivision) { throw new Error("TODO: Implement for " + this.constructor.name);}
    set durationTicks(velocity)  { throw new Error("TODO: Implement for " + this.constructor.name);}
    get durationTicks()          { throw new Error("TODO: Implement for " + this.constructor.name);}
    set duration(velocity)  { throw new Error("TODO: Not Implement for " + this.constructor.name);}
    get duration()          { throw new Error("TODO: Not Implement for " + this.constructor.name);}
    get clone()          { throw new Error("TODO: Implement for " + this.constructor.name);}

    /** @deprecated **/
    set velocity(velocity)  { throw new Error("TODO: Implement for " + this.constructor.name);}
    /** @deprecated **/
    get velocity()          { throw new Error("TODO: Implement for " + this.constructor.name);}
}


export default Instruction;



