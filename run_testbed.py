import os
import sys
from testbed.data_loader import TaskLoader
from testbed.runner import ExperimentRunner, ReportGenerator
from testbed.metrics import MetricsCalculator

def run_single_model(model_name, model_func, tasks, output_dir):
    """
    Runs experiment for a single model and saves specific results.
    """
    print(f"\n--- Running Evaluation for {model_name} ---")
    # Note: data_dir is relative to where this script is run or absolute
    base_dir = os.path.dirname(os.path.abspath(__file__))
    loader = TaskLoader(data_dir=os.path.join(base_dir, 'testbed', 'data'))
    
    runner = ExperimentRunner(model_func, loader)
    runner.run_experiment(model_name, tasks)
    
    results = runner.results
    metrics = MetricsCalculator.calculate_metrics(results)
    
    print(f"Results for {model_name}:")
    print(f"Accuracy: {metrics.get('accuracy', 0):.2f}%")
    print(f"Avg Latency: {metrics.get('avg_total_time', 0):.2f}s")
    
    # Generate model-specific reports
    report_gen = ReportGenerator(output_dir=output_dir)
    safe_name = model_name.replace("/", "_").replace("-", "_")
    
    report_gen.save_json(results, filename=f"test_report_{safe_name}.json")
    report_gen.save_csv(results, filename=f"results_{safe_name}.csv")
    
    # Save a summary table just for this model for convenience
    report_gen.generate_latex_table(metrics)
    
    return metrics

def main():
    print("=== CodeAlchemist TestBed (Real Models) ===")
    print("DEBUG: Starting main execution...", flush=True)

    # Move server imports here to prevent multiprocessing side-effects on Windows
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'server'))
    
    print("DEBUG: Importing server.app inside main...", flush=True)
    try:
        from server.app import generate_gemini_answer, generate_claude_answer, generate_gpt_answer
        print("DEBUG: Imported server.app successfully", flush=True)
    except Exception as e:
        print(f"ERROR: Failed to import server.app: {e}", flush=True)
        sys.exit(1)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(base_dir, 'testbed', 'data')
    output_dir = os.path.join(base_dir, 'test_results')
    
    loader = TaskLoader(data_dir=data_dir)
    
    # Load all tasks
    static_tasks = loader.load_static_tasks() # 12 tasks
    so_tasks = loader.load_stackoverflow_tasks() # 50 tasks
    
    tasks_to_run = static_tasks + so_tasks
    
    print(f"Loaded {len(tasks_to_run)} tasks for execution.")
    
    # Define models to test
    models_to_test = [
        ("Gemini-2.5-Flash", generate_gemini_answer, "models/gemini-2.5-flash"),
        ("Gemini-2.5-Flash-Lite", generate_gemini_answer, "models/gemini-2.5-flash-lite"),
        ("GPT-4o", generate_gpt_answer, "gpt-4o"),
        ("Claude-4.5-Sonnet", generate_claude_answer, "claude-sonnet-4-5-20250929"),
        ("Claude-4.5-Opus", generate_claude_answer, "claude-4-5-opus-placeholder")
    ]
    
    overall_metrics = {}
    all_results_flat = [] # For orchestration analysis
    
    for display_name, func, internal_id in models_to_test:
        try:
            print(f"\nStarting {display_name}...")
            
            # Use run_single_model logic, but we need 'all_results_flat' logic
            # So I'll inline the logic here or modify run_single_model to return results
            # The previous code inlined it. I will keep it consistent and correct.
            
            # Using ExperimentRunner directly to maintain control
            runner = ExperimentRunner(func, loader)
            runner.run_experiment(internal_id, tasks_to_run)
            
            results = runner.results
            
            # Augment results
            for r in results:
                r['model_display'] = display_name
                all_results_flat.append(r)

            metrics = MetricsCalculator.calculate_metrics(results)
            overall_metrics[display_name] = metrics
            
            # Save specific files
            report_gen = ReportGenerator(output_dir=output_dir)
            safe_name = display_name.replace(" ", "_").replace(".", "")
            report_gen.save_json(results, filename=f"test_report_{safe_name}.json")
            report_gen.save_csv(results, filename=f"results_{safe_name}.csv")
            
        except Exception as e:
            print(f"Failed to run for {display_name}: {e}")
            
    print("\n=== All Experiments Completed ===")
    
    # --- Orchestration Analysis ---
    # Goal: Compare Best Single Model vs. Ideal Orchestrator (Task-based routing)
    
    # 1. Identify Best Single Model (by Accuracy)
    best_single_model = None
    best_acc = -1
    for m_name, stats in overall_metrics.items():
        if stats.get('accuracy', 0) > best_acc:
            best_acc = stats.get('accuracy', 0)
            best_single_model = m_name
            
    # 2. Calculate Ideal Orchestrator Accuracy
    # For each task ID, if ANY model succeeded, count as success.
    task_ids = set(t.id for t in tasks_to_run)
    orchestrator_successes = 0
    total_tasks = len(task_ids)
    
    if total_tasks > 0:
        for tid in task_ids:
            # Check if any result for this task id is success=True
            if any(r['success'] for r in all_results_flat if r['task_id'] == tid):
                orchestrator_successes += 1
                
        orchestrator_acc = (orchestrator_successes / total_tasks) * 100
    else:
        orchestrator_acc = 0

    print("\nAggregate Summary:")
    for m, stats in overall_metrics.items():
        print(f"{m}: Accuracy={stats.get('accuracy', 0):.1f}%, Avg TTFT={stats.get('avg_ttft', 0):.3f}s")
        
    print(f"\n--- Orchestration Comparison ---")
    print(f"Best Single Model: {best_single_model} ({best_acc:.1f}%)")
    print(f"Ideal Orchestrator: {orchestrator_acc:.1f}%")
    if best_acc is not None:
        improvement = orchestrator_acc - best_acc
        print(f"Improvement: +{improvement:.1f}%")
        
        if improvement > 5.0:
            print("CONCLUSION: Task-based model orchestration significantly improves software development efficiency.")
        else:
            print("CONCLUSION: Single model performance is comparable to orchestration.")

if __name__ == '__main__':
    main()
