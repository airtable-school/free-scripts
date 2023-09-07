const config = input.config({
    title: 'Calculate Weight Differences',
    description: 'A script that analyzes a table of animal weight entries and calculates the difference in weight between entries based on a date field.',
    items: [
        input.config.table('weightTable', {
            label: 'Animal Weight table',
            description: 'The table where you track animal weights'
        }),
        input.config.field('animalField', {
            label: 'Animal Linked Record Field',
            description: 'The linked record field that points to the animal',
            parentTable: 'weightTable',
        }),
        input.config.field('weightField', {
            label: 'Weight Field',
            description: 'The field where you track the current weight',
            parentTable: 'weightTable',
        }),
        input.config.field('dateField', {
            label: 'Date Field',
            description: 'The field where you track date of the current weight',
            parentTable: 'weightTable',
        }),
        input.config.field('differenceField', {
            label: 'Weight Difference Field',
            description: 'The field to update weight differences',
            parentTable: 'weightTable',
        }),
    ]
});

/**
 * @typedef {Object} WeightRecord
 * @property {number} weight - The weight value.
 * @property {number} [difference] - The difference in weight.
 * @property {string} recordID - The id of the record.
 * 
 * * @typedef {Object.<string, WeightRecord>} DateRecord - Record indexed by date strings.
 * 
 * * @typedef {Object.<string, DateRecord>} AnimalWeights - Custom object indexed by recordID strings.
 */

async function getWeightDifferences() {
    const table = config.weightTable;
    const animalField = config.animalField;
    const weightField = config.weightField;
    const dateField = config.dateField;
    const diffField = config.differenceField;


    const query = await table.selectRecordsAsync({ fields: table.fields });

    /** @type {AnimalWeights} */
    let animalWeights = {};

    for (const record of query.records) {
        const id = record.id;
        const animalRecordID = record.getCellValue(animalField)[0].id;
        const date = record.getCellValueAsString(dateField);
        const weight = record.getCellValue(weightField);

        if (animalWeights[animalRecordID] === undefined) {
            animalWeights[animalRecordID] = {}
        }

        animalWeights[animalRecordID][date] = {
            recordID: id,
            weight: weight,
            difference: 0
        }; 
    }

    // sort date keys in reverse chronological order
    for (const animalRecordID in animalWeights) {
        const sortedDates = Object.keys(animalWeights[animalRecordID]).sort((a, b) => {
            const dateA = new Date(a).getTime();
            const dateB = new Date(b).getTime();
            return dateB - dateA;
        });

        // Create a new object and copy over the properties in sorted order
        /** @type {DateRecord} */
        const sortedObject = {};
        for (let i = 0; i < sortedDates.length; i++) {
            const currentDate = sortedDates[i];
            const previousDate = sortedDates[i + 1];
            const currentWeight = animalWeights[animalRecordID][currentDate].weight;
            const recordID = animalWeights[animalRecordID][currentDate].recordID;

            if (previousDate === undefined) {
                sortedObject[currentDate] = {
                    recordID: recordID,
                    weight: currentWeight,
                    difference: undefined
                }
                break;
            }

            const previousWeight = animalWeights[animalRecordID][previousDate].weight;
            const weightDifference = (currentWeight - previousWeight).toFixed(2);

            sortedObject[currentDate] = {
                recordID: recordID,
                weight: currentWeight,
                difference: +weightDifference // converts it back to a number
            };
        }

        animalWeights[animalRecordID] = sortedObject;
    }

    let updates = [];

    for (const animalRecordID in animalWeights) {

        for (const date in animalWeights[animalRecordID]) {
            const recordID = animalWeights[animalRecordID][date].recordID;
            const diff = animalWeights[animalRecordID][date].difference;

            updates.push({
                id: recordID,
                fields: {
                    [diffField.id]: diff
                }
            })

        }
    }

    while (updates.length > 0) {
        const batch = updates.slice(0, 50);
        await table.updateRecordsAsync(batch);
        updates = updates.slice(50);
    }
}

await getWeightDifferences();
