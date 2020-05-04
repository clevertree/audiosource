import React from "react";

import {Instruction, NoteInstruction, ProgramLoader, Song, Storage} from "../song";
import ASComposerMenu from "./ASComposerMenu";
import {ASUIDiv} from "../components";
import {ASCTrack} from "./track";
import Values from "../song/values/Values";
import ActiveTrackState from "./track/state/ActiveTrackState";

// import {TrackInfo} from "./track/";

class ASComposerActions extends ASComposerMenu {
    constructor(state = {}, props = {}) {
        super(state, props);
    }

    setStatus(newStatus) {
        console.info.apply(null, arguments); // (newStatus);
        this.setState({status: newStatus});
    }

    setError(newStatus) {
        this.setStatus(<ASUIDiv className="error">{newStatus}</ASUIDiv>);
    }

    setVersion(versionString) {
        this.setState({version: versionString});
    }

    /** Song rendering **/
    getSong() { return this.song; }

    setCurrentSong(song) {
        if(!song instanceof Song)
            throw new Error("Invalid current song");
        if(this.song) {
            this.setStatus("Unloading song: " + this.song.data.title);
            if(this.song.isPlaying) {
                this.song.stopPlayback();
            }
            this.song.removeEventListener('*', this.onSongEventCallback);
            this.song.unloadAll();
        }
        this.song = song;
        // console.log("Current Song: ", song);

        const activeTracks = {
            'root': {
                // destination: this.getAudioContext()
            },
        };

        this.song.addEventListener('*', this.onSongEventCallback);
        // this.setStatus("Initializing song: " + song.data.title);
        this.song.connect(this.getAudioContext());
        // this.setStatus("Loaded song: " + song.data.title);
        this.setState({
            status: "Loaded song: " + song.data.title,
            title: song.data.title,
            songUUID: song.data.uuid,
            songLength: song.getSongLengthInSeconds(),
            selectedTrack: song.getStartTrackName() || 'root',
            activeTracks
        });
    }

    updateCurrentSong() {
        this.setState({
            songLength: this.song.getSongLengthInSeconds(),
        });
    }


    loadMIDIInterface(callback) {
        // TODO: wait for user input
        if (navigator.requestMIDIAccess) {
            navigator.requestMIDIAccess().then(
                (MIDI) => {
                    console.info("MIDI initialized", MIDI);
                    const inputDevices = [];
                    MIDI.inputs.forEach(
                        (inputDevice) => {
                            inputDevices.push(inputDevice);
                            inputDevice.addEventListener('midimessage', callback);
                        }
                    );
                    console.log("MIDI input devices detected: " + inputDevices.map(d => d.name).join(', '));
                },
                (err) => {
                    throw new Error("error initializing MIDI: " + err);
                }
            );
        }
    }



    /** Playback **/


    getAudioContext() {
        if (this.audioContext)
            return this.audioContext;

        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.audioContext = audioContext;
        return audioContext;
    }

    getVolumeGain() {
        if (!this.volumeGain) {
            const context = this.getAudioContext();
            let gain = context.createGain();
            gain.gain.value = this.state.volume; // Song.DEFAULT_VOLUME;
            gain.connect(context.destination);
            this.volumeGain = gain;
        }
        return this.volumeGain;
    }

    getVolume () {
        if(this.volumeGain) {
            return this.volumeGain.gain.value;
        }
        return this.state.volume;
    }
    setVolume (volume) {
        console.info("Setting volume: ", volume);
        const gain = this.getVolumeGain();
        if(gain.gain.value !== volume) {
            gain.gain.value = volume;
        }
        this.setState({volume});
        // this.state.volume = volume;
    }

    /** Song actions **/


    async setSongNamePrompt(newSongTitle) {
        newSongTitle = await this.openPromptDialog("Enter a new song name", this.song.data.title);
        this.setSongName(newSongTitle);
    }
    setSongName(newSongTitle=null) {
        if(typeof newSongTitle !== "string")
            throw new Error("Invalid song title: " + newSongTitle);
        this.song.data.title = newSongTitle;
        this.setStatus(`Song title updated: ${newSongTitle}`);
    }

    async setSongVersionPrompt(newSongVersion) {
        newSongVersion = await this.openPromptDialog("Enter a new song version", this.song.data.version);
        this.setSongVersion(newSongVersion);
    }
    setSongVersion(newSongVersion) {
        if(typeof newSongVersion !== "string")
            throw new Error("Invalid song version: " + newSongVersion);
        this.song.data.version = newSongVersion;
        this.setStatus(`Song version updated: ${newSongVersion}`);
    }

    songChangeStartingBeatsPerMinute(newSongBeatsPerMinute) {
        this.song.data.beatsPerMinute = newSongBeatsPerMinute; // songChangeStartingBeatsPerMinute(newSongBeatsPerMinute);
        this.setStatus(`Song beats per minute updated: ${newSongBeatsPerMinute}`);
    }



    async openSongFromFileDialog(e, accept=null) {
        const file = await this.openFileDialog(accept);
        this.loadSongFromFileInput(e, file);
    }

    async loadSongFromFileInput(e, file=null, accept=null) {
        if(file === null)
            file = await this.openFileDialog(accept);
        if (!file)
            throw new Error("Invalid file input");
        const song = await Song.loadSongFromFileInput(file);
        this.setCurrentSong(song);
        // await this.song.loadSongFromFileInput(file);
        // this.render();
    }


    /** Song utilities **/

    loadDefaultSong(recentSongUUID = null) {
        const src = this.props.src || this.props.url;
        if (src) {
            this.loadSongFromURL(src);
            return true;
        }


        if (recentSongUUID) {
            try {
                this.loadSongFromMemory(recentSongUUID);
                return;
            } catch (e) {
                console.error(e);
                this.setError("Error: " + e.message)
            }
        }

        this.loadNewSongData();

        return false;
    }

    loadNewSongData() {
        // const storage = new Storage();
        // const defaultProgramURL = this.getDefaultProgramClass() + '';
        // let songData = storage.generateDefaultSong(defaultProgramURL);
        // const song = Song.loadSongFromData(songData);
        const song = new Song(this.audioContext);
        this.setCurrentSong(song);
        // this.forceUpdate();
        this.setStatus("Loaded new song", song.getProxiedData());
    }


    async loadRecentSongData() {
        const storage = new Storage();
        let songRecentUUIDs = await storage.getRecentSongList();
        if (songRecentUUIDs[0] && songRecentUUIDs[0].uuid) {
            this.setStatus("Loading recent song: " + songRecentUUIDs[0].uuid);
            this.loadSongFromMemory(songRecentUUIDs[0].uuid);
            return true;
        }
        return false;
    }


    loadSongFromMemory(songUUID) {
        const song = Song.loadSongFromMemory(this.audioContext, songUUID);
        this.setCurrentSong(song);
        this.setStatus("Song loaded from memory: " + songUUID, this.song, this.state);
//         console.info(songData);
    }

    loadSongFromURL(url) {
        const song = Song.loadSongFromURL(this.audioContext, url);
        this.setCurrentSong(song);
        this.setStatus("Loaded from url: " + url);
    }

    saveSongToMemory() {
        const song = this.song;
        const songData = song.data;
        const songHistory = song.history;
        const storage = new Storage();
        this.setStatus("Saving song to memory...");
        storage.saveSongToMemory(songData, songHistory);
        this.setStatus("Saved song to memory: " + songData.uuid);
    }

    saveSongToFile() {
        const songData = this.song.data;
        // const songHistory = this.song.history;
        const storage = new Storage();
        this.setStatus("Saving song to file");
        storage.saveSongToFile(songData);
    }


//         async loadSongFromMemory(songUUID) {
//             await this.song.loadSongFromMemory(songUUID);
//             this.forceUpdate();
//             this.setStatus("Song loaded from memory: " + songUUID);
// //         console.info(songData);
//         }
//
//         async loadSongFromFileInput(fileInput = null) {
//             fileInput = fileInput || this.fieldSongFileLoad.inputElm;
//             if (!fileInput || !fileInput.files || fileInput.files.length === 0)
//                 throw new Error("Invalid file input");
//             if (fileInput.files.length > 1)
//                 throw new Error("Invalid file input: only one file allowed");
//             const file = fileInput.files[0];
//             await this.song.loadSongFromFileInput(file);
//             this.forceUpdate();
//             this.setStatus("Song loaded from file: ", file);
//         }
//
//
//
//         async loadSongFromURL(url=null, promptUser=true) {
//             if (promptUser)
//                 url = await this.openPromptDialog("Enter a Song URL:", url || 'https://mysite.com/songs/mysong.json');
//             await this.song.loadSongFromURL(url);
//             this.setStatus("Song loaded from url: " + url);
//             // console.info(this.song.data);
//             this.forceUpdate();
//         }
//
//         async loadSongFromData(songData) {
//             await this.song.loadSongData(songData);
//             // this.render(true);
//             this.setStatus("Song loaded from data", songData);
//             this.forceUpdate();
//         }

    /** Song Playback Position **/

    updateSongPositionValue(songPosition) {
        this.setState({songPosition});
    }

    /** Song Playback **/

    async songPlay() {
        this.song.setPlaybackPosition(this.state.songPosition);
        await this.song.play(this.getVolumeGain());
    }

    async songPause() {
        this.song.stopPlayback();
    }

    async songStop() {
        if (this.song.playback)
            this.song.stopPlayback();
        this.song.setPlaybackPositionInTicks(0);
    }

    setSongPositionPercentage(playbackPercentage) {
        const playbackPosition = (playbackPercentage / 100) * this.state.songLength;
        return this.setSongPosition(playbackPosition);
    }

    setSongPosition(songPosition) {
        // TODO: parse % percentage
        if(typeof songPosition === 'string')
            songPosition = Values.parsePlaybackPosition(songPosition);
        if(isNaN(songPosition))
            throw new Error("Invalid song position: " + songPosition);
        this.setState({songPosition})
    }
    async setSongPositionPrompt() {
        let songPosition = Values.formatPlaybackPosition(this.state.songPosition || 0);
        songPosition = await this.openPromptDialog("Set playback position:", songPosition);
        this.setSongPosition(songPosition);
    }

    /** Instruction Modification **/

    async instructionInsertPrompt(newCommand = null, trackName = null, promptUser = false) {
        const trackState = new ActiveTrackState(this, trackName);
        if (newCommand === null)
            newCommand = trackState.currentCommand;
        newCommand = await this.openPromptDialog("Set custom command:", newCommand || '');
        return this.instructionInsert(newCommand);
    }

    instructionInsert(newCommand = null, trackName = null) {
        // const activeTracks = {...this.state.activeTracks};
        trackName = trackName || this.state.selectedTrack;
        const trackState = new ActiveTrackState(this, trackName);
        // if (programID !== null)
        //     newInstruction.program = programID;

        //: TODO: check for recursive group
        const song = this.song;
        // let selectedIndices = this.getSelectedIndices();

        // if(selectedIndices.length === 0)
        //     throw new Error("No selection");
        if (newCommand === null)
            newCommand = trackState.currentCommand;
        if (!newCommand)
            throw new Error("Invalid Instruction command");

        const newInstruction = Instruction.parseInstruction([0, newCommand]);
        trackState.update(state => state.currentCommand = newInstruction.command).then();
        if(trackState.currentDuration)
            newInstruction.durationTicks = song.values.parseDurationAsTicks(trackState.currentDuration);
        if(trackState.currentVelocity)
            newInstruction.velocity = trackState.currentVelocity;
        // this.setState({activeTracks});

        const songPositionTicks = trackState.cursorPositionTicks; // Using cursorPositionTicks is more accurate for insert
        let insertIndex = song.instructionInsertAtPosition(trackName, songPositionTicks, newInstruction);
        this.trackerSelectIndices(trackName, [insertIndex]);

        this.trackerPlay(trackName, [insertIndex]);
    }

    async instructionReplaceCommandSelectedPrompt(newCommand = null, trackName=null) {
        if (newCommand === null)
            newCommand = this.state.activeTracks[this.state.selectedTrack].currentCommand;
        newCommand = await this.openPromptDialog("Set custom command:", newCommand || '');
        return this.instructionReplaceCommandSelected(newCommand, trackName);
    }

    instructionReplaceCommandSelected(newCommand, trackName=null, selectedIndices=null) {
        const song = this.song;
        trackName = trackName || this.state.selectedTrack;
        const trackState = new ActiveTrackState(this, trackName);
        if(selectedIndices === null)
            selectedIndices = trackState.selectedIndices; // .getSelectedIndices();

        if (selectedIndices.length === 0)
            throw new Error("No selection");
        // if (newCommand === null)
        //     newCommand = trackInfo.track.currentCommand;
        if (!newCommand)
            throw new Error("Invalid Instruction command");

        // this.setState({currentTrackerCommand: newCommand});
        for (let i = 0; i < selectedIndices.length; i++) {
            song.instructionReplaceCommand(trackName, selectedIndices[i], newCommand);
        }

        this.trackerPlay(trackName, selectedIndices);
        // trackInfo.updateCurrentInstruction();
    }
    // }

    async instructionReplaceDurationSelected(duration = null, trackName = null, selectedIndices = null, promptUser = false) {
        const song = this.song;
        trackName = trackName || this.state.selectedTrack;
        const trackState = new ActiveTrackState(this, trackName);
        if(selectedIndices === null)
            selectedIndices = trackState.selectedIndices; // .getSelectedIndices();

        if (duration === null && promptUser)
            duration = parseInt(await this.openPromptDialog("Set custom duration in ticks:", duration), 10);

        if (typeof duration === 'string')
            duration = Values.parseDurationAsTicks(duration, this.song.data.timeDivision);
        else duration = parseInt(duration)

        if (isNaN(duration))
            throw new Error("Invalid duration: " + typeof duration);
        for (let i = 0; i < selectedIndices.length; i++) {
            song.instructionReplaceDuration(trackName, selectedIndices[i], duration);
        }
        this.trackerPlay(trackName, selectedIndices);
        this.setState(state => {
            state.activeTracks[trackName].currentDuration = duration;
        })
        // trackState.updateCurrentInstruction();
    }

    async instructionReplaceVelocityPrompt(velocity = null, trackName = null, selectedIndices = null) {
        trackName = trackName || this.state.selectedTrack;
        const trackState = new ActiveTrackState(this, trackName);
        velocity = parseInt(await this.openPromptDialog("Set custom velocity (0-127):", trackState.currentVelocity));
        return this.instructionReplaceVelocitySelected(velocity, trackName, selectedIndices);
    }

    instructionReplaceVelocitySelected(velocity = null, trackName = null, selectedIndices = null) {
        const song = this.song;
        trackName = trackName || this.state.selectedTrack;
        const trackState = new ActiveTrackState(this, trackName);
        if(selectedIndices === null)
            selectedIndices = trackState.selectedIndices || []; // .getSelectedIndices();

        velocity = parseFloat(velocity);
        if (velocity === null || isNaN(velocity))
            throw new Error("Invalid velocity: " + typeof velocity);
        for (let i = 0; i < selectedIndices.length; i++) {
            song.instructionReplaceVelocity(trackName, selectedIndices[i], velocity);
        }
        this.trackerPlay(trackName, selectedIndices);
        this.setState(state => {
            state.activeTracks[trackName].currentVelocity = velocity;
            return state;
        })
        // trackInfo.updateCurrentInstruction();
    }

    instructionDeleteSelected(trackName=null, selectedIndices=null) {
        trackName = trackName || this.state.selectedTrack;
        const trackState = new ActiveTrackState(this, trackName);
        if(selectedIndices === null)
            selectedIndices = trackState.selectedIndices || []; // .getSelectedIndices();

        for (let i = 0; i < selectedIndices.length; i++)
            this.song.instructionDeleteAtIndex(trackName, selectedIndices[i]);

    }

    /** Keyboard Commands **/

    keyboardChangeOctave(keyboardOctave = null) {
        if (!Number.isInteger(keyboardOctave))
            throw new Error("Invalid segment ID");
        this.setState({keyboardOctave});
    }

    /** ASComposer State **/

    async updateState(newState) {
        new Promise(resolve => {
            this.setState(state => {
                if(typeof newState === "function")
                    newState = newState(state) || state;
                return newState;
            }, resolve)
        })
    }


    // /** @deprecated **/
    // trackerGetTrackInfo(trackName) {
    //     return new TrackInfo(trackName, this);
    // }
    // trackerGetSelectedTrackInfo() {
    //     const trackName = this.state.selectedTrack;
    //     return new TrackInfo(trackName, this);
    // }


    /** Playback **/


    trackerPlaySelected(trackName=null, stopPlayback=true) {
        const trackState = new ActiveTrackState(this, trackName);
        return this.trackerPlay(trackName, trackState.selectedIndices, stopPlayback);
    }

    trackerPlay(trackName, selectedIndices, stopPlayback=true) {
        // const trackState = new ActiveTrackState(this, trackName);


        const song = this.getSong();
        if(stopPlayback && song.isPlaying())
            song.stopPlayback();

        let destination = this.getVolumeGain(); // TODO: get track destination


        // destination = destination || this.getDestination();
        if(!Array.isArray(selectedIndices))
            selectedIndices = [selectedIndices];
        // console.log('playInstructions', selectedIndices);
        // const programID = typeof trackState.programID !== "undefined" ? trackState.programID : 0;

        // if(stopPlayback)
        //     song.programLoader.stopAllPlayback();

        song.playSelectedInstructions(destination, trackName, selectedIndices);
    }


    /** ASCTrack Commands **/

    async trackAdd(newTrackName = null, promptUser = true) {
        const song = this.song;

        newTrackName = newTrackName || song.generateInstructionTrackName();
        if(promptUser)
            newTrackName = await this.openPromptDialog("Create new instruction group?", newTrackName);
        if (newTrackName) {
            song.trackAdd(newTrackName, []);
            await this.trackerToggleTrack(newTrackName, true);
        } else {
            this.setStatus("<span class='error'>Create instruction group canceled</span>");
        }
    }

    async trackRename(oldTrackName, newTrackName = null, promptUser = true) {
        const song = this.song;

        if(promptUser)
            newTrackName = await this.openPromptDialog(`Rename instruction group (${oldTrackName})?`, oldTrackName);
        if (newTrackName !== oldTrackName) {
            song.trackRename(oldTrackName, newTrackName);
            await this.trackerToggleTrack(newTrackName, true);
            await this.trackerToggleTrack(oldTrackName, false);
        } else {
            this.setStatus("<span class='error'>Rename instruction group canceled</span>");
        }
    }

    async trackRemove(trackName, promptUser = true) {
        const song = this.song;

        const result = promptUser ? await this.openPromptDialog(`Remove instruction group (${trackName})?`) : true;
        if (result) {
            song.trackRemove(trackName);
            await this.trackerToggleTrack(trackName, true);
        } else {
            this.setStatus("<span class='error'>Remove instruction group canceled</span>");
        }

    }

    async trackerToggleTrack(trackName = null, toggleValue=null, trackData={}) {
        // const trackState = this.trackGetState(trackName);
        // const activeTracks = {...this.state.activeTracks};
        let selectedTrack = trackName;
        if(toggleValue === true || typeof this.state.activeTracks[trackName] === "undefined") {
            // const currentTrackData = activeTracks[this.state.selectedTrack];
            // activeTracks[trackName] = trackData; //Object.assign({}, currentTrackData, trackData);
            await this.updateState(state => {
                state.selectedTrack = selectedTrack;
                state.activeTracks[trackName] = trackData
            })
            await this.trackerUpdateSegmentInfo(trackName);

        } else {
            trackData = this.state.activeTracks[trackName];
            if(trackData.destinationList)
                selectedTrack = trackData.destinationList.slice(-1)[0]; // Select last track
            else
                selectedTrack = this.getSong().getStartTrackName();
            await this.updateState(state => {
                state.selectedTrack = selectedTrack;
                delete state.activeTracks[trackName];
            })
        }
    }

    async trackerChangeQuantization(trackName, trackerQuantizationTicks) {
        if (!trackerQuantizationTicks || !Number.isInteger(trackerQuantizationTicks))
            throw new Error("Invalid quantization value");
        await this.updateState(state => {
            state.selectedTrack = trackName;
            state.activeTracks[trackName].quantizationTicks = trackerQuantizationTicks;
        });
        await this.trackerUpdateSegmentInfo(trackName);
    }

    async trackerChangeQuantizationPrompt(trackName) {
        const trackerQuantizationTicks = await this.composer.openPromptDialog(`Enter custom tracker quantization in ticks:`, this.track.quantizationTicks);
        await this.trackerChangeQuantization(trackName, trackerQuantizationTicks)
    }


    trackerChangeSegmentLength(trackName, trackerSegmentLengthInRows = null) {
        if (!trackerSegmentLengthInRows || !Number.isInteger(trackerSegmentLengthInRows))
            throw new Error("Invalid track row length value");
        this.setState(state => {
            state.activeTracks[trackName].rowLength = trackerSegmentLengthInRows;
            return state;
        });
    }

    async trackerChangeSegmentLengthPrompt(trackName) {
        const trackerSegmentLengthInRows = parseInt(await this.composer.openPromptDialog(`Enter custom tracker segment length in rows:`, this.track.rowLength));
        this.trackerChangeSegmentLength(trackName, trackerSegmentLengthInRows);
    }

    /**
     * Used when track has been modified
     * @param trackName
     * @returns {Promise<void>}
     */
    async trackerUpdateSegmentInfo(trackName) {
        trackName = trackName || this.state.selectedTrack;
        const trackState = new ActiveTrackState(this, trackName);
        const iterator = this.trackerGetIterator(trackName);
        iterator.seekToEnd();
        const trackLengthTicks = iterator.positionTicks;

        const qIterator = this.trackerGetQuantizedIterator(trackName);
        const segmentLengthTicks = trackState.segmentLengthTicks;
        const segmentPositions = [];
        let lastSegmentPositionTicks = 0;
        while ( qIterator.positionTicks < trackLengthTicks
                || segmentPositions.length < ASCTrack.DEFAULT_MIN_SEGMENTS) {
            if(lastSegmentPositionTicks <= qIterator.positionTicks) {
                // Found end of segment
                segmentPositions.push(qIterator.rowCount);
                lastSegmentPositionTicks += segmentLengthTicks;
            }
            qIterator.nextQuantizedInstructionRow();
        }

        // qIterator.seekToPosition()

        // if (!trackState.trackLengthTicks || trackLengthTicks > trackState.trackLengthTicks) {
            await trackState.update(state => {
                state.trackLengthTicks = trackLengthTicks;
                state.segmentPositions = segmentPositions;
                // console.log('trackLengthTicks', {segmentPositions, trackLengthTicks, qIterator});
            });
        // }
    }

    /** Selection **/

    trackerGetIterator(trackName=null) {
        const trackState = new ActiveTrackState(this, trackName);
        return this.getSong().instructionGetIterator(
            trackName,
            trackState.timeDivision, // || this.getSong().data.timeDivision,
            trackState.beatsPerMinute //  || this.getSong().data.beatsPerMinute
        );
    }

    trackerGetQuantizedIterator(trackName=null) {
        const trackState = new ActiveTrackState(this, trackName);
        return this.getSong().instructionGetQuantizedIterator(
            trackName,
            trackState.quantizationTicks,
            trackState.timeDivision, // || this.getSong().data.timeDivision,
            trackState.beatsPerMinute //  || this.getSong().data.beatsPerMinute
        );
    }

    /**
     * Used when selecting
     * @param trackName
     * @param cursorOffset
     * @returns {{positionTicks: PositionTickInfo[] | number, cursorRow, positionSeconds, previousOffset: number, nextRowOffset, cursorIndex: null, adjustedCursorRow, nextOffset: *, previousRowOffset}}
     */
    trackerGetCursorInfo(trackName=null, cursorOffset=null) {
        trackName = trackName || this.state.selectedTrack;
        const trackState = new ActiveTrackState(this, trackName);
        cursorOffset = cursorOffset === null ? trackState.cursorOffset : cursorOffset;
        const iterator = this.trackerGetQuantizedIterator(trackName);
        let cursorIndex = null;
        let currentRowStartPosition=0, lastRowStartPosition=0
        // let indexFound = null;
        while(iterator.cursorPosition <= cursorOffset) {
            lastRowStartPosition = currentRowStartPosition;
            currentRowStartPosition = iterator.cursorPosition;
            // eslint-disable-next-line no-loop-func
            iterator.nextQuantizedInstructionRow(null, function() {
                if(iterator.cursorPosition === cursorOffset) {
                    cursorIndex = iterator.currentIndex;
                }
            });

        }
        const column = cursorOffset - currentRowStartPosition;

        const cursorRow = iterator.rowCount;
        const currentRowOffset = trackState.rowOffset || 0;
        const rowLength = trackState.rowLength || 16;
        let adjustedCursorRow = null;
        if(currentRowOffset + rowLength <= cursorRow)
            adjustedCursorRow = cursorRow - rowLength; //  - Math.floor(currentRowLength * 0.8);
        if(currentRowOffset >= cursorRow)
            adjustedCursorRow = cursorRow - 1; // - Math.ceil(currentRowLength * 0.2);



        const nextRowOffset = iterator.cursorPosition + column;
        const previousRowOffset = lastRowStartPosition + column;
        // console.log({p: iterator.cursorPosition, cursorOffset, column, previousRowOffset, nextRowOffset});
        const ret = {
            positionTicks: iterator.positionTicks,
            positionSeconds: iterator.positionSeconds,
            cursorIndex,
            cursorRow,
            adjustedCursorRow,
            previousOffset: cursorOffset > 0 ? cursorOffset - 1 : 0,
            nextOffset: cursorOffset + 1,
            previousRowOffset,
            nextRowOffset
        };
        // console.log(ret);
        return ret;
    }

    // trackerFindRowOffsetFromPosition(trackName, trackPositionTicks) {
    //     // const trackState = new ActiveTrackState(this, trackName);
    //     const iterator = this.trackerGetQuantizedIterator(trackName);
    //     iterator.seekToPositionTicks(trackPositionTicks);
    //     const rowOffset = iterator.rowCount;
    //     console.log('trackerFindRowOffsetFromPosition', trackPositionTicks, rowOffset, iterator);
    //     return rowOffset;
    // }

    async trackerSelectIndicesPrompt(trackName=null) {
        if(trackName === null)
            trackName = this.state.selectedTrack;
        const trackState = new ActiveTrackState(this, trackName);
        let selectedIndices = (trackState.selectedIndices || []).join(', ');
        selectedIndices = await this.openPromptDialog(`Select indices for track ${trackName}: `, selectedIndices);
        this.trackerSelectIndices(trackName, selectedIndices);
    }

    trackerSelectIndices(trackName, selectedIndices, cursorOffset=null) {
        // console.log('trackerSelectIndices', {trackName, selectedIndices, cursorOffset, rowOffset});
        // TODO: get song position by this.props.index
        // let selectedIndices = await this.composer.openPromptDialog("Enter selection: ", oldSelectedIndices.join(','));
        if (typeof selectedIndices === "string") {
            switch (selectedIndices) {
                case 'all':
                    selectedIndices = [];
                    const maxLength = this.song.instructionFindGroupLength(this.trackName);
                    for (let i = 0; i < maxLength; i++)
                        selectedIndices.push(i);
                    break;
                case 'segment':
                    selectedIndices = [].map.call(this.querySelectorAll('asct-instruction'), (elm => elm.index));
                    break;
                case 'row':
                    throw new Error('TODO');
                case 'none':
                    selectedIndices = [];
                    break;
                default:
                    selectedIndices = selectedIndices.split(/[^0-9]/).map(index => parseInt(index));
                    // throw new Error("Invalid selection: " + selectedIndices);
            }
        }

        if (typeof selectedIndices === 'number')
            selectedIndices = [selectedIndices];
        if (!Array.isArray(selectedIndices))
            throw new Error("Invalid selection: " + selectedIndices);

        selectedIndices.forEach((index, i) => {
            if(typeof index !== "number")
                throw new Error(`Invalid selection index (${i}): ${index}`);
        });

        // Filter unique indices
        selectedIndices = selectedIndices.filter((v, i, a) => a.indexOf(v) === i && v !== null);
        // Sort indices
        selectedIndices.sort((a, b) => a - b);
        // console.info('ASComposerActions.trackerSelectIndices', trackName, selectedIndices);


        this.setState(state => {
            state.selectedTrack = trackName;
            const trackState = state.activeTracks[trackName];
            trackState.selectedIndices = selectedIndices;
            if(cursorOffset !== null) {
                const cursorInfo = this.trackerGetCursorInfo(trackName, cursorOffset);
                trackState.cursorOffset = cursorOffset;
                // TODO: rowOffset = this.trackerGetCursorInfo(cursorOffset).adjustedCursorRow;
                // if (rowOffset !== null)
                if(cursorInfo.adjustedCursorRow !== null)
                    trackState.rowOffset = cursorInfo.adjustedCursorRow;
                trackState.cursorPositionTicks = cursorInfo.positionTicks;
                state.songPosition = cursorInfo.positionSeconds + (trackState.startPosition || 0);
            }
            // If selected, update default instruction params
            if(selectedIndices.length > 0) {
                const firstSelectedInstruction = this.getSong().instructionGetByIndex(trackName, selectedIndices[0]);
                trackState.currentCommand = firstSelectedInstruction.command;
                if(firstSelectedInstruction instanceof NoteInstruction) {
                    if(typeof firstSelectedInstruction.durationTicks !== "undefined")
                        trackState.currentDuration = firstSelectedInstruction.getDurationString(trackState.timeDivision || this.getSong().data.timeDivision);
                    if(typeof firstSelectedInstruction.velocity !== "undefined")
                        trackState.currentVelocity = firstSelectedInstruction.velocity;
                }
            }
            return state;
        });
        return selectedIndices;
    }



    trackerSetCursorOffset(trackName, newCursorOffset, selectedIndices=[]) {
        if (!Number.isInteger(newCursorOffset))
            throw new Error("Invalid cursor offset");
        if(newCursorOffset < 0)
            throw new Error("Cursor offset must be >= 0");
        return this.trackerSelectIndices(trackName, selectedIndices, newCursorOffset);
    }

    trackerSetScrollPosition(trackName, newScrollPositionTicks) {
        if (!Number.isInteger(newScrollPositionTicks))
            throw new Error("Invalid row offset");
        this.setState(state => {
            state.activeTracks[trackName].scrollPositionTicks = newScrollPositionTicks;
            return state;
        });
    }

    // trackerSetRowOffset

    // trackerSetRowOffsetFromPositionTicks(trackName, trackPositionTicks) {
    //     const rowOffset = this.trackerFindRowOffsetFromPosition(trackName, trackPositionTicks);
    //     this.trackerSetRowOffset(trackName, rowOffset);
    // }

    trackerSetRowOffset(trackName, newRowOffset) {
        if (!Number.isInteger(newRowOffset))
            throw new Error("Invalid row offset");
        // console.log('trackerSetRowOffset', {trackName, newRowOffset});
        this.setState(state => {
            state.selectedTrack = trackName;
            state.activeTracks[trackName].rowOffset = newRowOffset;
            return state;
        });
    }


    // trackerUpdateCurrentInstruction(trackName) {
    //     this.setState(state => {
    //         const track = state.activeTracks[trackName];
    //         const selectedIndices = track.selectedIndices;
    //         if(selectedIndices.length > 0) {
    //             const firstSelectedInstruction = this.getSong().instructionGetByIndex(this.getTrackName(), selectedIndices[0]);
    //             track.currentCommand = firstSelectedInstruction.command;
    //             if(firstSelectedInstruction instanceof NoteInstruction) {
    //                 if(typeof firstSelectedInstruction.durationTicks !== "undefined")
    //                     track.currentDuration = firstSelectedInstruction.getDurationString(this.getStartingTimeDivision());
    //                 if(typeof firstSelectedInstruction.velocity !== "undefined")
    //                     track.currentVelocity = firstSelectedInstruction.velocity;
    //             }
    //         }
    //         return state;
    //     });
    //
    // }

    /** @deprecated **/
    trackerCalculateRowOffset(trackName, cursorOffset=null) {
        return this.trackerGetTrackInfo(trackName).calculateRowOffset(trackName, cursorOffset);
    }

    /** @deprecated **/
    trackerFindCursorRow(trackName, cursorOffset=null) {
        return this.trackerGetTrackInfo(trackName).findCursorRow(trackName, cursorOffset);
    }





    /** Context menu **/
    // async openContextMenu(e) {
    //     const contextMenu = this.menuContext;
    //     await contextMenu.openContextMenu(e);
    // }

    /** Programs **/


    async programAdd(programClassName, programConfig = {}, promptUser=false) {
        if (!programClassName)
            throw new Error(`Invalid program class`);
        const {title} = ProgramLoader.getProgramClassInfo(programClassName);
        // programConfig = ProgramLoader.createProgramConfig(programClassName, programConfig);
        // programConfig.libraryURL = this.defaultLibraryURL;
        // programConfig.name = programConfig.name || programURL.split('/').pop();

//         e.target.form.elements['programURL'].value = '';
        if (promptUser === false || await this.openConfirmDialog(`Add '${title}' to Song?`)) {
            const programID = this.song.programAdd(programConfig);
            this.setStatus(`New program class '${programClassName}' added to song at position ${programID}`);
            // this.forceUpdate();
            // this.fieldInstructionProgram.setValue(programID);
            // await this.panelPrograms.forceUpdate();

        } else {
            this.setError(`New program canceled: ${programClassName}`);
        }
    }

    async programReplace(programID, programClassName, programConfig = {}) {
        if (!Number.isInteger(programID))
            throw new Error(`Invalid Program ID: Not an integer`);
        if (!programClassName)
            throw new Error(`Invalid Program class`);

        if (await this.openPromptDialog(`Change Program (${programID}) to ${programClassName}`)) {
            await this.song.programReplace(programID, programClassName, programConfig);
            this.setStatus(`Program (${programID}) changed to: ${programClassName}`);

        } else {
            this.setError(`Change program canceled: ${programClassName}`);
        }
    }

    async programRename(programID, newProgramTitle = null) {
        console.log(this.song.programGetConfig(programID).title, programID);
        const oldProgramTitle = this.song.programGetConfig(programID).title;
        if (!newProgramTitle)
            newProgramTitle = await this.openPromptDialog(`Change name for programs ${programID}: `, oldProgramTitle);
        if (!newProgramTitle)
            return console.error("Program name change canceled");
        this.song.programRename(programID, newProgramTitle);
        this.setStatus(`Program title updated: ${newProgramTitle}`);
    }

    async programRemove(programRemoveID = null) {
        if (await this.openConfirmDialog(`Remove Program ID: ${programRemoveID}`)) {
            this.song.programRemove(programRemoveID);
            this.setStatus(`Program (${programRemoveID}) removed`);

        } else {
            this.setError(`Remove program canceled`);
        }
    }


    /** Toggle Panels **/

    // togglePanelPrograms() {
    //     this.classList.toggle('hide-panel-programs');
    // }
    //
    // togglePanelTracker() {
    //     this.classList.toggle('hide-panel-track');
    // }
    //
    // togglePanelSong() {
    //     this.classList.toggle('hide-panel-song');
    // }
    //
    // toggleFullscreen() {
    //     const setFullScreen = !this.classList.contains('fullscreen');
    //     this.classList.toggle('fullscreen', setFullScreen);
    // }

    /** Tools **/



    async batchSelect(e, searchCallbackString = null, promptUser = false) {
        if (promptUser || !searchCallbackString)
            searchCallbackString = await this.openPromptDialog("Run custom search:", searchCallbackString ||
                `/** Example Search **/ i.command === "C3"   &&   i.program === 0`);
        if (!searchCallbackString)
            throw new Error("Batch command canceled: Invalid search");

        const storage = new Storage();
        storage.addBatchRecentSearches(searchCallbackString);

        throw new Error("TODO Implement");
        // const track = this.track;
        // this.clearselectedIndices();
        // const trackName = track.getTrackName();
        // try {
        //     const stats = {count: 0};
        //     const iterator = this.song.instructionGetIterator(trackName);
        //     let instruction;
        //     while (instruction = iterator.nextConditionalInstruction((instruction) => {
        //         const i = instruction;
        //         const window = null, document = null;
        //         return eval(searchCallbackString);
        //     })) {
        //         stats.count++;
        //         track.selectIndicies(e, iterator.currentIndex);
        //     }
        //     this.setStatus("Batch Search Completed: " + JSON.stringify(stats), stats);
        // } catch (err) {
        //     this.setStatus("Batch Search Failed: " + err.message, err);
        // }
    }

    async batchRunCommand(e, commandCallbackString = null, searchCallbackString = null, promptUser = false) {
        const storage = new Storage();

        if (promptUser || !searchCallbackString)
            searchCallbackString = await this.openPromptDialog("Run custom search:", searchCallbackString ||
                `/** Example Search **/ i.command === "C3"   &&   i.program === 0`);
        if (!searchCallbackString)
            throw new Error("Batch command canceled: Invalid search");
        storage.addBatchRecentSearches(searchCallbackString);


        if (promptUser || !commandCallbackString)
            commandCallbackString = await this.openPromptDialog(`Run custom command:`, commandCallbackString ||
                `/** Example Command **/ i.command='C4';`);
        if (!commandCallbackString)
            throw new Error("Batch command canceled: Invalid command");
        storage.addBatchRecentCommands(commandCallbackString);

        throw new Error("TODO Implement");
        // const instructionList = [];
        // const track = this.track;
        // const trackName = track.getTrackName(), g = trackName;
        // try {
        //     const stats = {count: 0, modified: 0};
        //     const iterator = this.song.instructionGetIterator(trackName);
        //     let instruction;
        //     const window = null, document = null;
        //     while (instruction = iterator.nextConditionalInstruction((instruction) => {
        //         const i = instruction;
        //         return eval(searchCallbackString);
        //     })) {
        //         const instructionString = JSON.stringify(instruction.data);
        //         const i = instruction;
        //         eval(commandCallbackString);
        //         if (instructionString !== JSON.stringify(instruction.data))
        //             stats.modified++;
        //
        //         stats.count++;
        //         track.selectIndex(e, iterator.currentIndex);
        //     }
        //     this.setStatus("Batch Command Completed: " + JSON.stringify(stats), stats);
        //     return instructionList;
        // } catch (err) {
        //     this.setStatus("Batch Command Failed: " + err.message, err);
        //     return [];
        // }
    }


    /** Prompt **/

    openPromptDialog(message, defaultValue='') {
        return window.prompt(message, defaultValue);
    }

    async openFileDialog(accept=null) {
        return await new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.setAttribute('type', 'file');
            if(accept)
                input.setAttribute('accept', accept);
            input.addEventListener('change', () => {
                const file = input.files[0];
                if(file)
                    resolve(file);
                else
                    reject();
            });
            input.click();
        })
    }

}


export default ASComposerActions;
