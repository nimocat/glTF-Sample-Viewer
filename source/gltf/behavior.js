import { GltfObject } from './gltf_object.js';

import { Behavior } from '@khronosgroup/gltf-behavior';
import { JsonPointer } from 'json-ptr';
import { PointerTargetProperty } from './pointer_target_property';
class gltfBehavior extends GltfObject
{
    constructor()
    {
        super();
        this.errors = [];
    }

    initGl(gltf, webGlContext)
    {
        super.initGl(gltf, webGlContext);

        this.behavior.context.setCallback = (pointer, value) => {
            const targetProperty = JsonPointer.get(gltf, pointer);

            // Check if the property is a valid target for the behavior to avoid messing up the viewer 
            // state if the extension is used in an invalid way
            if (targetProperty === undefined || !(targetProperty instanceof PointerTargetProperty)) {
                if (!this.errors.includes(pointer)) {
                    console.warn(`Cannot target ${pointer} in behavior`);
                    this.errors.push(pointer);
                }
                return;
            }

            targetProperty.setValue(value);
        };
        this.behavior.context.getCallback = (pointer) => {
            const targetProperty = JsonPointer.get(gltf, pointer);

            // Check if the property is a valid target for the behavior to avoid messing up the viewer 
            // state if the extension is used in an invalid way
            if (targetProperty === undefined || !(targetProperty instanceof PointerTargetProperty)) {
                if (!this.errors.includes(pointer)) {
                    console.warn(`Cannot target ${pointer} in behavior`);
                    this.errors.push(pointer);
                }
                return undefined;
            }

            return targetProperty.value();
        };
    }

    initState(state) {
        super.initState(state);
        this.behavior.context.animationSetTimeCallback = (animation, time) => {
            state.animations[animation].timer.setTime(time);
        };
        this.behavior.context.animationSetPlayingCallback = (animation, isPlaying) => {
            if (isPlaying) {
                state.animations[animation].timer.continue();
            } else {
                state.animations[animation].timer.pause();
            }
            
        };
        this.behavior.context.animationsResetCallback = (animation) => {
            state.animations[animation].timer.stop();
        };
        this.behavior.context.animationSetSpeedCallback = (animation, speed) => {
            state.animations[animation].timer.speed = speed;
        };
        this.behavior.context.animationSetRepetitionsCallback = (animation, repetitions) => {
            state.animations[animation].timer.repetitions = repetitions;
        };
    }

    fromJson(jsonBehavior)
    {
        super.fromJson(jsonBehavior);
        this.behavior = new Behavior(jsonBehavior);
    }

    processEvents(events)
    {
        for (const event of events) {
            const toProperCase = String.prototype.toProperCase = (str) => {
                return str.replace(/\w\S*/g, (txt) => {return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
            };
            const normalizedEventName = toProperCase(event.name);
            this.behavior.runOnEvent(`on${normalizedEventName}`, event.data);
        }
    }
}


export { gltfBehavior };