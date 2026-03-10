const axios = require('axios');

/**
 * Content Viewer Service
 *
 * Handles AI helpers, content transformations, and item operations.
 * Proxies to the engine for vision model processing.
 */

const ENGINE_URL = process.env.ENGINE_URL || 'http://localhost:8000';

// ============================================================================
// AI HELPERS (Backend-powered)
// ============================================================================

const runAiHelper = async (helperId, content, params = {}) => {
    console.log(`[MOCK] Running mock AI helper: ${helperId} (engine not implemented)`);

    if (helperId === 'ai_image_descriptions') {
        return generateMockImageDescriptions(content);
    }

    return {
        success: false,
        error: `Helper '${helperId}' not implemented`,
        modifiedItems: [],
    };
};

const generateImageDescriptionsFromImages = async (documentId, images) => {
    console.log(`[IMAGE-DESCRIPTIONS] Generating descriptions for ${images.length} images in document: ${documentId}`);

    try {
        const response = await axios.post(
            `${ENGINE_URL}/api/ingestion/helper/ai_image_descriptions`,
            { documentId, images },
            { timeout: 120000 }
        );

        console.log(`[IMAGE-DESCRIPTIONS] Engine response: success=${response.data?.success}`);
        return response.data;
    } catch (error) {
        console.error('[IMAGE-DESCRIPTIONS] Engine error:', error.message);

        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            console.log('[IMAGE-DESCRIPTIONS] Falling back to mock descriptions');
            return generateMockImageDescriptionsFromImages(documentId, images);
        }

        if (error.response) {
            return {
                success: false,
                descriptions: [],
                message: error.response.data?.detail || 'Engine error',
            };
        }

        throw error;
    }
};

const streamImageDescriptions = async (documentId, images, res) => {
    console.log(`[IMAGE-DESCRIPTIONS-STREAM] Streaming descriptions for ${images.length} images in document: ${documentId}`);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
        const response = await axios({
            method: 'POST',
            url: `${ENGINE_URL}/api/ingestion/helper/ai_image_descriptions/stream`,
            data: { documentId, images },
            responseType: 'stream',
            timeout: 300000,
        });

        response.data.on('data', (chunk) => {
            const data = chunk.toString();
            res.write(data);
        });

        response.data.on('end', () => {
            console.log('[IMAGE-DESCRIPTIONS-STREAM] Stream completed');
            res.end();
        });

        response.data.on('error', (error) => {
            console.error('[IMAGE-DESCRIPTIONS-STREAM] Stream error:', error.message);
            res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
            res.end();
        });

    } catch (error) {
        console.error('[IMAGE-DESCRIPTIONS-STREAM] Engine error:', error.message);

        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            console.log('[IMAGE-DESCRIPTIONS-STREAM] Falling back to mock streaming');
            await streamMockImageDescriptions(documentId, images, res);
            return;
        }

        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
    }
};

const streamMockImageDescriptions = async (documentId, images, res) => {
    res.write(`data: ${JSON.stringify({ type: 'start', total: images.length, documentId })}\n\n`);

    for (const img of images) {
        const classification = img.classification || 'unclassified';
        const mockDescriptions = {
            'logo': 'This is a company logo representing the brand identity.',
            'icon': 'This is a small icon used for visual emphasis.',
            'screenshot_from_computer': 'This is a screenshot showing a software interface.',
            'flow_chart': 'This is a flow chart illustrating a process workflow.',
            'bar_chart': 'This is a bar chart presenting data comparison.',
        };

        const description = mockDescriptions[classification] || `[Mock] Image of type: ${classification}`;

        res.write(`data: ${JSON.stringify({
            type: 'description',
            imageId: img.id,
            classification,
            description: `${description} (Mock - vision model unavailable)`,
        })}\n\n`);

        await new Promise(resolve => setTimeout(resolve, 100));
    }

    res.write(`data: ${JSON.stringify({ type: 'done', success: images.length, total: images.length })}\n\n`);
    res.end();
};

// ============================================================================
// MOCK DATA
// ============================================================================

const generateMockImageDescriptions = (content) => {
    const modifiedItems = [];

    if (content?.pages) {
        for (const page of content.pages) {
            for (const item of page.items || []) {
                if (item.type === 'image' && !item.deleted) {
                    modifiedItems.push({
                        id: item.id,
                        description: `AI-generated description for ${item.classification || 'image'} on page ${page.pageNumber}`
                    });
                }
            }
        }
    }

    return {
        success: true,
        modifiedItems,
        message: `Generated descriptions for ${modifiedItems.length} images`
    };
};

const getPromptForClassification = (classification) => {
    const prompts = {
        logo: 'This appears to be a company or brand logo.',
        figure: 'This is a figure or illustration that visualizes concepts from the document.',
        chart: 'This is a chart or graph presenting data.',
        diagram: 'This is a diagram illustrating a process, structure, or relationship.',
        photo: 'This is a photograph capturing a real-world scene or subject.',
        screenshot: 'This is a screenshot showing a user interface or application window.',
        table_image: 'This is an image of a table containing structured data.',
        other: 'This is a visual element that provides context to the document content.',
        unclassified: 'This is a visual element found in the document.',
    };
    return prompts[classification] || prompts.unclassified;
};

const generateMockImageDescriptionsFromImages = (documentId, images) => {
    const descriptions = images.map((img) => {
        const classificationHint = getPromptForClassification(img.classification);
        return {
            imageId: img.id,
            classification: img.classification || 'unclassified',
            description: `${classificationHint} Found on page ${img.pageNumber}. [Mock description - vision model unavailable]`,
        };
    });

    return {
        success: true,
        descriptions,
        message: `Generated descriptions for ${descriptions.length} image(s)`,
    };
};

module.exports = {
    runAiHelper,
    generateImageDescriptionsFromImages,
    streamImageDescriptions,
};
