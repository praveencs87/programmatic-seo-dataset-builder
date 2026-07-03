import { armKillSwitch, disarmKillSwitch } from './utils/timeoutManager.js';
import { Actor, log } from 'apify';
import { CITIES } from './cities.js';

// Convert a string to a clean URL slug
function toSlug(str) {
    return str
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

// Apply template substitution for {service} and {location}
function applyTemplate(template, service, location) {
    return template
        .replace(/\{service\}/gi, service)
        .replace(/\{location\}/gi, location);
}

await Actor.init();

try {
    const input = await Actor.getInput();
    const {
        services = [],
        locations = [],
        country = '',
        titleTemplates = ['Best {service} in {location}'],
        slugTemplate = '{service}-{location}'
    } = input;

    if (!services || services.length === 0) {
        throw new Error('At least one service keyword is required!');
    }

    // Resolve locations: custom > built-in city database
    let resolvedLocations = locations && locations.length > 0
        ? locations
        : (country && CITIES[country] ? CITIES[country] : []);

    if (resolvedLocations.length === 0) {
        throw new Error('No locations found. Provide custom locations or select a country (US, IN, UK).');
    }

    const totalRows = services.length * resolvedLocations.length * titleTemplates.length;
    log.info(`🚀 Generating ${totalRows} rows (${services.length} services × ${resolvedLocations.length} locations × ${titleTemplates.length} templates)...`);

    // PPE: Base charge for starting
    await Actor.charge({ eventName: 'apify-actor-start', count: 1 });

    let generatedCount = 0;
    const BATCH_SIZE = 500; // Push in batches for efficiency
    let batch = [];

    for (const service of services) {
        for (const location of resolvedLocations) {
            for (const template of titleTemplates) {
                const keyword = `${service} ${location}`;
                const pageTitle = applyTemplate(template, service, location);
                const urlSlug = toSlug(applyTemplate(slugTemplate, service, location));
                const metaDescription = `Find the best ${service} services in ${location}. Compare prices, read reviews, and hire top-rated local ${service} professionals.`;

                batch.push({
                    service,
                    location,
                    keyword,
                    page_title: pageTitle,
                    url_slug: urlSlug,
                    meta_description: metaDescription
                });

                generatedCount++;

                // Push in batches
                if (batch.length >= BATCH_SIZE) {
                    await Actor.pushData(batch);
                    await Actor.charge({ eventName: 'row-generated', count: batch.length });
                    batch = [];
                }
            }
        }
    }

    // Flush remaining
    if (batch.length > 0) {
        await Actor.pushData(batch);
        await Actor.charge({ eventName: 'row-generated', count: batch.length });
    }

    log.info(`🎉 Done! Generated ${generatedCount} programmatic SEO rows in milliseconds.`);
} catch (error) {
    console.error('CRASH:', error);
    throw error;
} finally {
    await Actor.exit();
}
