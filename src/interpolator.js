import { InterpolationModes } from './animation_sampler.js';
import { InterpolationPath } from './channel.js';
import { clamp, jsToGlSlice } from './utils.js';
import { quat, glMatrix } from 'gl-matrix';

class gltfInterpolator
{
    constructor()
    {
        this.prevKey = 0;
        this.prevT = 0.0;
    }

    slerpQuat(q1, q2, t)
    {
        let quatResult = quat.create();
        quat.slerp(quatResult, q1, q2, t);
        quat.normalize(quatResult, quatResult);
        return quatResult;
    }

    linear(prevKey, nextKey, output, t, stride)
    {
        const result = new glMatrix.ARRAY_TYPE(stride);

        for(let i = 0; i < stride; ++i)
        {
            result[i] = output[prevKey * stride + i] * (1-t) + output[nextKey * stride + i] * t;
        }

        return result;
    }

    cubicSpline(prevKey, nextKey, output, keyDelta, t, stride)
    {
        const prevIndex = prevKey * stride;
        const nextIndex = nextKey * stride;
        const A = 0;
        const V = 1;
        const B = 2;

        let result = new glMatrix.ARRAY_TYPE(stride);
        const tSq = t * t;
        const tCub = tSq * t;

        // we assume that the components are layed out like this: in-tangent, point, out-tangent in output
        // https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#appendix-c-spline-interpolation
        for(let i = 0; i < stride; ++i)
        {
            const p0 = output[prevIndex + V + i];
            const m0 = keyDelta * output[prevIndex + B + i];
            const p1 = output[nextIndex + V + i];
            const m1 = keyDelta * output[nextIndex + A + i];

            result[i] = ((2*tCub - 3*tSq + 1) * p0) + ((tCub - 2*tSq + t) * m0) + ((-2*tCub + 3*tSq) * p1) + ((tCub - tSq) * m1);
        }

        return result;
    }

    resetKey()
    {
        this.prevKey = 0;
    }

    interpolate(gltf, channel, sampler, t, stride)
    {
        const input = gltf.accessors[sampler.input].getDeinterlacedView(gltf);
        const output = gltf.accessors[sampler.output].getDeinterlacedView(gltf);

        if(output.length === stride) // no interpolation for single keyFrame animations
        {
            return jsToGlSlice(output, 0, stride);
        }

        let nextKey = undefined;

        const maxKeyTime = input[input.length - 1];
        t = t % maxKeyTime; // loop animation

        if (this.prevT > t)
        {
            this.prevKey = 0;
        }

        this.prevT = t;

        for (let i = this.prevKey; i < input.length; ++i) // find current keyframe interval
        {
            if (t <= input[i])
            {
                nextKey = i;
                break;
            }
        }

        nextKey = clamp(nextKey, 1, input.length - 1);
        this.prevKey = clamp(nextKey - 1, 0, nextKey);

        const keyDelta = input[nextKey] - input[this.prevKey];
        t = (t - input[this.prevKey]) / keyDelta; // normalize t to 0..1

        if(channel.target.path === InterpolationPath.ROTATION)
        {
            return this.slerpQuat(this.getQuat(output, this.prevKey), this.getQuat(output, nextKey), t);
        }

        switch(sampler.interpolation)
        {
            case InterpolationModes.STEP: return jsToGlSlice(output, this.prevKey * stride, stride); // t < 0.5 ? output[preKey] : output[nextKey]
            case InterpolationModes.CUBICSPLINE: return this.cubicSpline(this.prevKey, nextKey, output, keyDelta, t, stride);
            default: return this.linear(this.prevKey, nextKey, output, t, stride);
        }
    }

    getQuat(output, index)
    {
        return quat.fromValues(output[4 * index], output[4 * index + 1], output[4 * index + 2], output[4 * index + 3]);
    }
}

export { gltfInterpolator };
